import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeedDrink } from "@/lib/types";

/** Attach short-lived signed URLs for drink photos (the bucket is private). */
export async function withPhotos(
  supabase: SupabaseClient,
  drinks: FeedDrink[],
): Promise<FeedDrink[]> {
  const paths = drinks.map((d) => d.photo_path).filter(Boolean) as string[];
  if (paths.length === 0) return drinks;
  const { data } = await supabase.storage
    .from("drink-photos")
    .createSignedUrls(paths, 60 * 60);
  const urls = new Map(
    (data ?? []).filter((r) => r.signedUrl).map((r) => [r.path, r.signedUrl]),
  );
  return drinks.map((d) => ({
    ...d,
    photo_url: d.photo_path ? urls.get(d.photo_path) ?? null : null,
  }));
}
