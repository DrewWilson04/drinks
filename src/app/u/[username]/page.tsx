import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient, requireMe } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { DrinkCard } from "@/components/DrinkCard";
import { StatsView, type StatRow } from "@/components/StatsView";
import { follow, unfollow } from "@/app/actions";
import { FEED_SELECT } from "@/lib/drinks";
import { withPhotos } from "@/lib/feed";
import type { FeedDrink, Profile } from "@/lib/types";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const me = await requireMe();
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username.toLowerCase())
    .maybeSingle<Profile>();
  if (!profile) notFound();

  const isMe = profile.id === me.id;
  const path = `/u/${profile.username}`;

  const { data: rel } = await supabase
    .from("follows")
    .select("status")
    .eq("follower_id", me.id)
    .eq("following_id", profile.id)
    .maybeSingle<{ status: "pending" | "accepted" }>();

  const canView = isMe || !profile.is_private || rel?.status === "accepted";

  const [followers, following, statRows, drinksRes] = await Promise.all([
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", profile.id)
      .eq("status", "accepted"),
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", profile.id)
      .eq("status", "accepted"),
    canView
      ? supabase
          .from("drinks")
          .select("consumed_at, standard_drinks, drink_type")
          .eq("user_id", profile.id)
          .order("consumed_at", { ascending: false })
          .limit(5000)
          .returns<StatRow[]>()
      : null,
    canView
      ? supabase
          .from("drinks")
          .select(FEED_SELECT)
          .eq("user_id", profile.id)
          .order("consumed_at", { ascending: false })
          .limit(20)
          .returns<FeedDrink[]>()
      : null,
  ]);
  const drinks = await withPhotos(supabase, drinksRes?.data ?? []);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-start sm:text-left">
        <Avatar profile={profile} size={80} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">
            {profile.display_name || profile.username}
            {profile.is_private && <span className="ml-2 text-base" title="Private account">🔒</span>}
          </h1>
          <div className="text-muted">@{profile.username}</div>
          {profile.bio && <p className="mt-2 whitespace-pre-wrap">{profile.bio}</p>}
          {canView && (
            <div className="mt-2 flex justify-center gap-4 text-sm sm:justify-start">
              <span><b className="tabular-nums">{followers.count ?? 0}</b> <span className="text-muted">followers</span></span>
              <span><b className="tabular-nums">{following.count ?? 0}</b> <span className="text-muted">following</span></span>
            </div>
          )}
        </div>
        <div>
          {isMe ? (
            <Link href="/settings" className="btn">Edit profile</Link>
          ) : rel?.status === "accepted" ? (
            <form action={unfollow.bind(null, profile.id, path)}>
              <button className="btn">Following ✓</button>
            </form>
          ) : rel?.status === "pending" ? (
            <form action={unfollow.bind(null, profile.id, path)}>
              <button className="btn" title="Cancel request">Requested</button>
            </form>
          ) : (
            <form action={follow.bind(null, profile.id, path)}>
              <button className="btn btn-primary">
                {profile.is_private ? "Request to follow" : "Follow"}
              </button>
            </form>
          )}
        </div>
      </section>

      {canView ? (
        <>
          <StatsView rows={statRows?.data ?? []} compact />
          <section className="flex flex-col gap-3">
            <h2 className="font-semibold">Recent drinks</h2>
            {drinks.length === 0 && <p className="text-muted">No drinks logged yet.</p>}
            {drinks.map((d) => (
              <DrinkCard key={d.id} drink={d} meId={me.id} />
            ))}
          </section>
        </>
      ) : (
        <div className="card py-10 text-center">
          <div className="text-4xl">🔒</div>
          <p className="mt-3 font-medium">This account is private</p>
          <p className="mt-1 text-sm text-muted">
            {rel?.status === "pending"
              ? "Your request is waiting for approval."
              : "Follow them to see their drinks once they approve."}
          </p>
        </div>
      )}
    </div>
  );
}
