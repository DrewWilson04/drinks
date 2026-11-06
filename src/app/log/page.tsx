import { createClient, requireMe } from "@/lib/supabase/server";
import { LogForm } from "./LogForm";
import type { Drink } from "@/lib/types";

export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const me = await requireMe();
  const { group } = await searchParams;
  const supabase = await createClient();

  const [{ data: memberships }, { data: recent }] = await Promise.all([
    supabase
      .from("group_members")
      .select("group:groups(id, name, kind, ends_at)")
      .eq("user_id", me.id)
      .returns<{ group: { id: string; name: string; kind: string; ends_at: string | null } }[]>(),
    supabase
      .from("drinks")
      .select("drink_type, name, volume_ml, abv")
      .eq("user_id", me.id)
      .order("consumed_at", { ascending: false })
      .limit(30)
      .returns<Pick<Drink, "drink_type" | "name" | "volume_ml" | "abv">[]>(),
  ]);

  const now = Date.now();
  const groups = (memberships ?? [])
    .map((m) => m.group)
    .filter((g) => g && (!g.ends_at || new Date(g.ends_at).getTime() > now - 86400_000))
    .map((g) => ({ id: g.id, name: g.name }));

  // Distinct recent drinks for one-tap repeat.
  const seen = new Set<string>();
  const presets = (recent ?? []).filter((d) => {
    const key = `${d.drink_type}|${d.name}|${d.volume_ml}|${d.abv}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">Log a drink</h1>
      <LogForm
        userId={me.id}
        groups={groups}
        recent={presets}
        defaultGroup={groups.some((g) => g.id === group) ? group : undefined}
      />
    </div>
  );
}
