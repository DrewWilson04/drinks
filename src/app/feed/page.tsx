import Link from "next/link";
import { createClient, requireMe } from "@/lib/supabase/server";
import { DrinkCard } from "@/components/DrinkCard";
import { Tabs } from "@/components/Tabs";
import { FEED_SELECT } from "@/lib/drinks";
import { withPhotos } from "@/lib/feed";
import type { FeedDrink } from "@/lib/types";

const PAGE = 30;

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; before?: string }>;
}) {
  const me = await requireMe();
  const { scope: rawScope, before } = await searchParams;
  const scope = rawScope === "everyone" ? "everyone" : "following";
  const supabase = await createClient();

  let query = supabase
    .from("drinks")
    .select(FEED_SELECT)
    .order("consumed_at", { ascending: false })
    .limit(PAGE);

  if (before) query = query.lt("consumed_at", before);

  if (scope === "following") {
    const { data: follows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", me.id)
      .eq("status", "accepted");
    const ids = [me.id, ...(follows ?? []).map((f) => f.following_id)];
    query = query.in("user_id", ids);
  }

  const { data } = await query.returns<FeedDrink[]>();
  const drinks = await withPhotos(supabase, data ?? []);
  const last = drinks.at(-1);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Tabs
          active={scope}
          items={[
            { value: "following", label: "Following", href: "/feed" },
            { value: "everyone", label: "Everyone", href: "/feed?scope=everyone" },
          ]}
        />
        <Link href="/people" className="btn px-3 py-1.5">Find people</Link>
      </div>

      {drinks.length === 0 ? (
        <div className="card py-10 text-center">
          <div className="text-4xl">🫗</div>
          <p className="mt-3 font-medium">Nothing here yet</p>
          <p className="mt-1 text-sm text-muted">
            {scope === "following"
              ? "Log your first drink or follow some people."
              : "Nobody has logged a public drink yet."}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Link href="/log" className="btn btn-primary">Log a drink</Link>
            <Link href="/people" className="btn">Find people</Link>
          </div>
        </div>
      ) : (
        drinks.map((d) => <DrinkCard key={d.id} drink={d} meId={me.id} />)
      )}

      {drinks.length === PAGE && last && (
        <Link
          href={`/feed?${new URLSearchParams({
            ...(scope === "everyone" ? { scope } : {}),
            before: last.consumed_at,
          })}`}
          className="btn self-center"
        >
          Older
        </Link>
      )}
    </div>
  );
}
