import Link from "next/link";
import { createClient, requireMe } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/ProfileForm";
import { Avatar } from "@/components/Avatar";
import { respondToFollow } from "@/app/actions";
import type { ProfileLite } from "@/lib/types";

export default async function SettingsPage() {
  const me = await requireMe();
  const supabase = await createClient();
  const { data: requests } = await supabase
    .from("follows")
    .select("follower:profiles!follows_follower_id_fkey(id, username, display_name, avatar_url)")
    .eq("following_id", me.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .returns<{ follower: ProfileLite }[]>();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Settings</h1>
        <Link href={`/u/${me.username}`} className="btn">View profile</Link>
      </div>

      {requests && requests.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold">Follow requests</h2>
          <ul className="flex flex-col gap-2">
            {requests.map(({ follower }) => (
              <li key={follower.id} className="card flex items-center gap-3">
                <Avatar profile={follower} size={36} />
                <Link href={`/u/${follower.username}`} className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {follower.display_name || follower.username}
                  </div>
                  <div className="truncate text-sm text-muted">@{follower.username}</div>
                </Link>
                <form action={respondToFollow.bind(null, follower.id, true)}>
                  <button className="btn btn-primary px-3 py-1.5">Accept</button>
                </form>
                <form action={respondToFollow.bind(null, follower.id, false)}>
                  <button className="btn px-3 py-1.5">Decline</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-semibold">Profile</h2>
        <ProfileForm profile={me} submitLabel="Save changes" />
      </section>

      <form action="/auth/signout" method="post">
        <button className="btn btn-danger w-full">Sign out</button>
      </form>
    </div>
  );
}
