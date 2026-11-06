import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { createClient, requireMe } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { ConfirmButton } from "@/components/ConfirmButton";
import { CopyButton } from "@/components/CopyButton";
import { DrinkCard } from "@/components/DrinkCard";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { Tabs } from "@/components/Tabs";
import { deleteGroup, leaveGroup, removeMember } from "@/app/actions";
import { FEED_SELECT } from "@/lib/drinks";
import { withPhotos } from "@/lib/feed";
import { PERIODS, parsePeriod } from "@/lib/periods";
import type { FeedDrink, Group, LeaderboardRow, ProfileLite } from "@/lib/types";

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; period?: string }>;
}) {
  const me = await requireMe();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: group } = await supabase
    .from("groups")
    .select("*")
    .eq("id", id)
    .maybeSingle<Group>();
  if (!group) notFound();

  const tab = sp.tab === "drinks" || sp.tab === "members" ? sp.tab : "leaderboard";
  const period = sp.period ? parsePeriod(sp.period) : group.kind === "event" ? "all" : "7d";

  const { data: members } = await supabase
    .from("group_members")
    .select("role, joined_at, profile:profiles(id, username, display_name, avatar_url)")
    .eq("group_id", id)
    .order("joined_at")
    .returns<{ role: "owner" | "member"; joined_at: string; profile: ProfileLite }[]>();

  const amOwner = members?.some((m) => m.profile.id === me.id && m.role === "owner") ?? false;

  let board: LeaderboardRow[] = [];
  let drinks: FeedDrink[] = [];
  if (tab === "leaderboard") {
    const { data } = await supabase
      .rpc("leaderboard", { period, scope: "group", gid: id, max_rows: 100 });
    board = (data ?? []) as LeaderboardRow[];
  } else if (tab === "drinks") {
    const { data } = await supabase
      .from("drinks")
      .select(FEED_SELECT)
      .eq("group_id", id)
      .order("consumed_at", { ascending: false })
      .limit(50)
      .returns<FeedDrink[]>();
    drinks = await withPhotos(supabase, data ?? []);
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const inviteUrl = `${proto}://${host}/groups/join/${group.invite_code}`;
  const base = `/groups/${id}`;

  return (
    <div className="flex flex-col gap-5">
      <section>
        <div className="flex items-start gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-3xl">
            {group.kind === "event" ? "🎉" : "👯"}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">{group.name}</h1>
            <div className="text-sm text-muted">
              {group.kind === "event" ? "Event" : "Group"} · {members?.length ?? 0} members
            </div>
            {group.kind === "event" && (group.starts_at || group.ends_at) && (
              <div className="text-sm text-muted">
                {group.starts_at && fmt(group.starts_at)}
                {group.starts_at && group.ends_at && " – "}
                {group.ends_at && fmt(group.ends_at)}
              </div>
            )}
          </div>
        </div>
        {group.description && <p className="mt-3 whitespace-pre-wrap">{group.description}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/log?group=${id}`} className="btn btn-primary">+ Log a drink here</Link>
          <CopyButton text={inviteUrl} label="Copy invite link" />
        </div>
        <p className="mt-2 text-xs text-muted">
          Invite code: <code className="font-mono">{group.invite_code}</code>
        </p>
      </section>

      <Tabs
        active={tab}
        items={[
          { value: "leaderboard", label: "Leaderboard", href: base },
          { value: "drinks", label: "Drinks", href: `${base}?tab=drinks` },
          { value: "members", label: "Members", href: `${base}?tab=members` },
        ]}
      />

      {tab === "leaderboard" && (
        <div className="flex flex-col gap-3">
          <Tabs
            active={period}
            items={PERIODS.map((p) => ({
              value: p.value,
              label: p.label,
              href: `${base}?period=${p.value}`,
            }))}
          />
          <LeaderboardTable rows={board} meId={me.id} />
          <p className="text-xs text-muted">Counts drinks logged to this {group.kind}.</p>
        </div>
      )}

      {tab === "drinks" && (
        <div className="flex flex-col gap-3">
          {drinks.length === 0 && (
            <div className="card py-8 text-center text-muted">No drinks logged here yet.</div>
          )}
          {drinks.map((d) => (
            <DrinkCard key={d.id} drink={d} meId={me.id} />
          ))}
        </div>
      )}

      {tab === "members" && (
        <ul className="flex flex-col gap-2">
          {(members ?? []).map((m) => (
            <li key={m.profile.id} className="card flex items-center gap-3">
              <Avatar profile={m.profile} size={36} />
              <Link href={`/u/${m.profile.username}`} className="min-w-0 flex-1">
                <div className="truncate font-medium">{m.profile.display_name || m.profile.username}</div>
                <div className="truncate text-sm text-muted">
                  @{m.profile.username}{m.role === "owner" && " · owner"}
                </div>
              </Link>
              {amOwner && m.profile.id !== me.id && (
                <form action={removeMember.bind(null, id, m.profile.id)}>
                  <ConfirmButton className="btn btn-danger px-3 py-1.5" message={`Remove ${m.profile.username}?`}>
                    Remove
                  </ConfirmButton>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 border-t border-border pt-4">
        {amOwner ? (
          <form action={deleteGroup.bind(null, id)}>
            <ConfirmButton message={`Delete ${group.name} for everyone? Drinks stay on people's profiles.`}>
              Delete {group.kind}
            </ConfirmButton>
          </form>
        ) : (
          <form action={leaveGroup.bind(null, id)}>
            <ConfirmButton message={`Leave ${group.name}?`}>Leave {group.kind}</ConfirmButton>
          </form>
        )}
      </div>
    </div>
  );
}
