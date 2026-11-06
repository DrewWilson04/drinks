import type { DrinkType } from "@/lib/types";

export const DRINK_TYPES: {
  type: DrinkType;
  label: string;
  emoji: string;
  volumeMl: number;
  abv: number;
}[] = [
  { type: "beer", label: "Beer", emoji: "🍺", volumeMl: 355, abv: 5 },
  { type: "wine", label: "Wine", emoji: "🍷", volumeMl: 150, abv: 12 },
  { type: "cocktail", label: "Cocktail", emoji: "🍸", volumeMl: 120, abv: 15 },
  { type: "shot", label: "Shot", emoji: "🥃", volumeMl: 44, abv: 40 },
  { type: "spirit", label: "Spirit / mixed", emoji: "🥂", volumeMl: 250, abv: 7 },
  { type: "cider", label: "Cider", emoji: "🍏", volumeMl: 355, abv: 5 },
  { type: "seltzer", label: "Seltzer", emoji: "🫧", volumeMl: 355, abv: 5 },
  { type: "other", label: "Other", emoji: "🍹", volumeMl: 250, abv: 5 },
];

export const SIZE_PRESETS: { label: string; ml: number }[] = [
  { label: "Shot (44 ml)", ml: 44 },
  { label: "Glass of wine (150 ml)", ml: 150 },
  { label: "Can (355 ml / 12 oz)", ml: 355 },
  { label: "Bottle (330 ml)", ml: 330 },
  { label: "UK pint (568 ml)", ml: 568 },
  { label: "US pint (473 ml)", ml: 473 },
  { label: "Tallboy (473 ml / 16 oz)", ml: 473 },
];

export function drinkMeta(type: DrinkType) {
  return DRINK_TYPES.find((d) => d.type === type) ?? DRINK_TYPES[7];
}

/** US standard drinks (14 g of alcohol). Mirrors the database column. */
export function standardDrinks(volumeMl: number, abv: number) {
  return Math.round(((volumeMl * abv) / 100) * 0.789 / 14 * 100) / 100;
}

export function formatStd(n: number) {
  const v = Number(n);
  return v.toFixed(v >= 10 ? 0 : 1);
}

export function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 0) return "upcoming";
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: diff > 86400 * 300 ? "numeric" : undefined,
  });
}

/** The select used for drinks in feeds (author, group, cheers, comment count). */
export const FEED_SELECT =
  "*, profile:profiles!drinks_user_id_fkey(id, username, display_name, avatar_url), group:groups(id, name), cheers(user_id), comments(count)";
