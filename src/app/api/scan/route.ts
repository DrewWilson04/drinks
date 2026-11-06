import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recognizeDrinks, RecognitionUnavailableError } from "@/lib/recognize";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type ImageType = (typeof TYPES)[number];

/** POST multipart/form-data with `image` (file) and/or `text`. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const file = form.get("image");
  const text = String(form.get("text") ?? "").trim();
  let image: { base64: string; mediaType: ImageType } | undefined;

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Photo is too large." }, { status: 413 });
    }
    if (!TYPES.includes(file.type as ImageType)) {
      return NextResponse.json({ error: "Use a JPEG, PNG, WebP or GIF photo." }, { status: 415 });
    }
    image = {
      base64: Buffer.from(await file.arrayBuffer()).toString("base64"),
      mediaType: file.type as ImageType,
    };
  }

  if (!image && !text) {
    return NextResponse.json({ error: "Send a photo or some text." }, { status: 400 });
  }

  try {
    const result = await recognizeDrinks({ image, text });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof RecognitionUnavailableError) {
      return NextResponse.json(
        { error: "Drink scanning isn't set up on this server yet." },
        { status: 503 },
      );
    }
    console.error("scan failed", err);
    return NextResponse.json(
      { error: "Couldn't scan that. Try again or fill it in by hand." },
      { status: 502 },
    );
  }
}
