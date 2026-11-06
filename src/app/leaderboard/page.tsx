import { createClient, requireMe } from "@/lib/supabase/server";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { Tabs } from "@/components/Tabs";
import { PERIODS, parsePeriod } from "@/lib/periods";
import type { LeaderboardRow } from "@/lib/types";

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; scope?: string }>;
}) {
  const me = await requireMe();
  const sp = await searchParams;
  const period = parsePeriod(sp.period);
  const scope = sp.scope === "everyone" ? "everyone" : "following";
  const supabase = await createClient();

  const { data } = await supabase.rpc("leaderboard", { period, scope, max_rows: 50 });
  const rows = (data ?? []) as LeaderboardRow[];

  const href = (p: string, s: string) => `/leaderboard?period=${p}&scope=${s}`;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Leaderboard</h1>
      <div className="flex flex-col gap-2">
        <Tabs
          active={scope}
          items={[
            { value: "following", label: "Friends", href: href(period, "following") },
            { value: "everyone", label: "Everyone", href: href(period, "everyone") },
          ]}
        />
        <Tabs
          active={period}
          items={PERIODS.map((p) => ({ value: p.value, label: p.label, href: href(p.value, scope) }))}
        />
      </div>
      <LeaderboardTable rows={rows} meId={me.id} />
      <p className="text-xs text-muted">
        Ranked by standard drinks. &ldquo;Everyone&rdquo; includes public accounts and
        anyone whose drinks you can see.
      </p>
    </div>
  );
}
