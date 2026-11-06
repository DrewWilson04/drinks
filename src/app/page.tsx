import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/supabase/server";

export default async function Home() {
  const me = await getMe();
  if (me) redirect(me.onboarded ? "/feed" : "/onboarding");

  return (
    <div className="flex flex-col items-center py-12 text-center">
      <div className="text-6xl">🍻</div>
      <h1 className="mt-4 text-4xl font-bold tracking-tight">drinks</h1>
      <p className="mt-3 max-w-md text-muted">
        Log what you&apos;re drinking, follow your friends, start a group for the
        night out, and see who&apos;s leading the round.
      </p>
      <Link href="/login" className="btn btn-primary mt-8 px-6 py-3 text-base">
        Get started
      </Link>
      <div className="mt-12 grid w-full gap-3 text-left sm:grid-cols-2">
        {[
          ["🍺", "Log every drink", "Type, size, ABV, notes and a photo. We work out the standard drinks."],
          ["🏆", "Leaderboards", "Today, this week, this month or all time, across everyone or just friends."],
          ["👯", "Groups & events", "Make a group for the crew or an event for tonight, and share the invite link."],
          ["🔒", "Your call on privacy", "Public profile, or private where you approve who follows you."],
        ].map(([emoji, title, body]) => (
          <div key={title} className="card">
            <div className="text-2xl">{emoji}</div>
            <div className="mt-2 font-semibold">{title}</div>
            <div className="mt-1 text-sm text-muted">{body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
