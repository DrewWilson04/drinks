import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { DrinkType } from "@/lib/types";

/**
 * Turns a photo of a drink (can, bottle, glass, menu) or a short message like
 * "had 3 modelos" into structured drink entries using Claude.
 *
 * Shared by the in-app scanner and, later, SMS logging.
 */

const MODEL = "claude-opus-5-5";

const DRINK_TYPE_VALUES = [
  "beer",
  "wine",
  "cocktail",
  "shot",
  "spirit",
  "cider",
  "seltzer",
  "other",
] as const satisfies readonly DrinkType[];

const RecognizedDrink = z.object({
  drink_type: z.enum(DRINK_TYPE_VALUES),
  name: z.string().max(80),
  volume_ml: z.number().positive().max(5000),
  abv: z.number().min(0).max(100),
  quantity: z.number().int().min(1).max(30),
  read_from_label: z.boolean(),
});

const RecognitionResult = z.object({
  drinks: z.array(RecognizedDrink).max(10),
  message: z.string().max(200),
});

export type RecognizedDrink = z.infer<typeof RecognizedDrink>;
export type RecognitionResult = z.infer<typeof RecognitionResult>;

// JSON schema for structured outputs (kept in sync with the zod schema above).
const JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["drinks", "message"],
  properties: {
    drinks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["drink_type", "name", "volume_ml", "abv", "quantity", "read_from_label"],
        properties: {
          drink_type: { type: "string", enum: [...DRINK_TYPE_VALUES] },
          name: {
            type: "string",
            description: "Brand and product, e.g. 'Modelo Especial'. Empty if unknown.",
          },
          volume_ml: { type: "number", description: "Volume of ONE unit in millilitres." },
          abv: { type: "number", description: "Alcohol by volume, percent (5 means 5%)." },
          quantity: { type: "integer", description: "How many units." },
          read_from_label: {
            type: "boolean",
            description: "True if volume and ABV were read from the label/text, false if estimated.",
          },
        },
      },
    },
    message: {
      type: "string",
      description: "One short, friendly sentence for the user about what was logged or why nothing was.",
    },
  },
} as const;

const SYSTEM = `You help people log alcoholic drinks in a drink-tracking app.
From a photo or a short message, identify each alcoholic drink and return structured entries.

Rules:
- Read the brand, product name, volume and ABV from the label when visible. US cans often show "12 FL OZ" (355 ml), "16 FL OZ" (473 ml), "24 FL OZ" (710 ml); convert to ml.
- If something isn't visible or stated, use the well-known values for that product (e.g. Modelo Especial is 4.4% ABV, 355 ml can) and set read_from_label to false. If the product is unknown, use typical values for the drink type.
- quantity: count identical units in the photo (e.g. a 6-pack shows 6, but only count the ones being logged if the message says so), or use the number in the message ("3 modelos" → 3). Default 1.
- Group identical drinks into one entry with a quantity; list different drinks separately.
- drink_type: beer, wine, cocktail, shot (straight spirit, ~44 ml), spirit (mixed drink like a vodka soda), cider, seltzer (hard seltzer), other.
- Non-alcoholic drinks (soda, water, 0.0% beer) and anything that isn't a drink: return no entries and say so in message.
- Don't comment on how much someone is drinking. Keep message under 20 words.`;

export class RecognitionUnavailableError extends Error {}

export async function recognizeDrinks(input: {
  image?: { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" };
  text?: string;
}): Promise<RecognitionResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new RecognitionUnavailableError("ANTHROPIC_API_KEY is not set");
  }
  const client = new Anthropic();

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (input.image) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: input.image.mediaType, data: input.image.base64 },
    });
  }
  const text = input.text?.trim().slice(0, 500);
  content.push({
    type: "text",
    text: text
      ? `The user says: """${text}"""`
      : "What drink(s) are in this photo?",
  });

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: JSON_SCHEMA },
    },
    system: SYSTEM,
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal") {
    return { drinks: [], message: "Couldn't read that one. Try another photo or type it in." };
  }

  const textBlock = response.content.find(
    (b): b is Anthropic.Beta.BetaTextBlock => b.type === "text",
  );
  if (!textBlock) throw new Error("No output from model");
  const parsed = RecognitionResult.safeParse(JSON.parse(textBlock.text));
  if (!parsed.success) throw new Error("Model output didn't match the schema");
  return parsed.data;
}
