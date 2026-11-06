import Link from "next/link";
import { createClient, requireMe } from "@/lib/supabase/server";
import { CreateGroupForm, JoinGroupForm } from "./GroupForms";
import type { Group } from "@/lib/types";

function eventStatus(g: Group) {
  const now = Date.now();
  if (g.kind !== "event") return null;
  if (g.starts_at && new Date(g.starts_at).getTime() > now) return "Upcoming";
  if (g.ends_at && new Date(g.ends_at).getTime() < now) return "Ended";
  return "Live";
}

export default async function GroupsPage() {
  const me = await requireMe();
  const supabase = await createClient();
  const { data } = await supabase
    .from("group_members")
    .select("role, group:groups(*, group_members(count))")
    .eq("user_id", me.id)
    .order("joined_at", { ascending: false })
    .returns<{ role: string; group: Group & { group_members: { count: number }[] } }[]>();

  const groups = (data ?? []).filter((m) => m.group);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Groups & events</h1>

      <section className="flex flex-col gap-2">
        {groups.length === 0 && (
          <div className="card py-8 text-center text-muted">
            You&apos;re not in any groups yet. Create one or join with an invite code.
          </div>
        )}
        {groups.map(({ group: g, role }) => {
          const status = eventStatus(g);
          return (
            <Link key={g.id} href={`/groups/${g.id}`} className="card flex items-center gap-3 hover:bg-surface-2">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-xl">
                {g.kind === "event" ? "🎉" : "👯"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{g.name}</div>
                <div className="truncate text-sm text-muted">
                  {g.group_members[0]?.count ?? 0} members
                  {role === "owner" && " · owner"}
                  {status && ` · ${status}`}
                </div>
              </div>
            </Link>
          );
        })}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 font-semibold">Create</h2>
          <CreateGroupForm />
        </section>
        <section className="card">
          <h2 className="mb-3 font-semibold">Join with a code</h2>
          <JoinGroupForm />
        </section>
      </div>
    </div>
  );
}
