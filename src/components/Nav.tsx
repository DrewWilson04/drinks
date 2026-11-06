import Link from "next/link";
import { getMe, createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { NavLinks } from "@/components/NavLinks";

export async function Nav() {
  const me = await getMe();
  let requests = 0;
  if (me?.onboarded) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", me.id)
      .eq("status", "pending");
    requests = count ?? 0;
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
        <Link href={me ? "/feed" : "/"} className="text-lg font-bold tracking-tight">
          🍻 drinks
        </Link>
        {me?.onboarded && (
          <>
            <div className="ml-auto hidden sm:block">
              <NavLinks />
            </div>
            <Link href="/log" className="btn btn-primary ml-auto px-3 py-1.5 sm:ml-0">
              + Log
            </Link>
            <Link href="/settings" className="relative" aria-label="Settings">
              <Avatar profile={me} size={32} />
              {requests > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                  {requests}
                </span>
              )}
            </Link>
          </>
        )}
      </div>
      {me?.onboarded && (
        <div className="border-t border-border px-4 py-2 sm:hidden">
          <NavLinks />
        </div>
      )}
    </header>
  );
}
