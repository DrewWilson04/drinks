import Link from "next/link";
import { createClient, requireMe } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import type { Profile } from "@/lib/types";

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const me = await requireMe();
  const { q = "" } = await searchParams;
  const supabase = await createClient();
  const term = q.trim().replace(/[%_,()\\]/g, "");

  let query = supabase
    .from("profiles")
    .select("*")
    .eq("onboarded", true)
    .neq("id", me.id)
    .limit(30);
  query = term
    ? query.or(`username.ilike.%${term}%,display_name.ilike.%${term}%`).order("username")
    : query.order("created_at", { ascending: false });
  const { data: people } = await query.returns<Profile[]>();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Find people</h1>
      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          className="input"
          placeholder="Search by name or username"
          aria-label="Search people"
          autoFocus
        />
        <button className="btn">Search</button>
      </form>
      {!term && <p className="text-sm text-muted">Newest members</p>}
      <ul className="flex flex-col gap-2">
        {(people ?? []).map((p) => (
          <li key={p.id}>
            <Link href={`/u/${p.username}`} className="card flex items-center gap-3 hover:bg-surface-2">
              <Avatar profile={p} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">
                  {p.display_name || p.username} {p.is_private && <span title="Private account">🔒</span>}
                </div>
                <div className="truncate text-sm text-muted">@{p.username}</div>
              </div>
            </Link>
          </li>
        ))}
        {people?.length === 0 && <p className="text-muted">No one found.</p>}
      </ul>
    </div>
  );
}
