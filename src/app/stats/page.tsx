import Link from "next/link";
import { createClient, requireMe } from "@/lib/supabase/server";
import { StatsView, type StatRow } from "@/components/StatsView";

export default async function StatsPage() {
  const me = await requireMe();
  const supabase = await createClient();
  const { data } = await supabase
    .from("drinks")
    .select("consumed_at, standard_drinks, drink_type")
    .eq("user_id", me.id)
    .order("consumed_at", { ascending: false })
    .limit(5000)
    .returns<StatRow[]>();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My stats</h1>
        <Link href={`/u/${me.username}`} className="btn px-3 py-1.5">My drinks</Link>
      </div>
      <StatsView rows={data ?? []} />
      <p className="text-xs text-muted">
        One standard drink is 14 g of pure alcohol (the US definition): about a
        355 ml beer at 5%, 150 ml of wine at 12%, or a 44 ml shot at 40%.
      </p>
    </div>
  );
}
