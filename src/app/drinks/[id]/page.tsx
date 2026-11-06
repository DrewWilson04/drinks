import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient, requireMe } from "@/lib/supabase/server";
import { DrinkCard } from "@/components/DrinkCard";
import { Avatar } from "@/components/Avatar";
import { CommentForm } from "./CommentForm";
import { ConfirmButton } from "@/components/ConfirmButton";
import { deleteComment, deleteDrink } from "@/app/actions";
import { FEED_SELECT, timeAgo } from "@/lib/drinks";
import { withPhotos } from "@/lib/feed";
import type { Comment, FeedDrink } from "@/lib/types";

export default async function DrinkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireMe();
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("drinks")
    .select(FEED_SELECT)
    .eq("id", id)
    .returns<FeedDrink[]>()
    .maybeSingle();
  if (!data) notFound();
  const [drink] = await withPhotos(supabase, [data]);

  const { data: comments } = await supabase
    .from("comments")
    .select("*, profile:profiles(id, username, display_name, avatar_url)")
    .eq("drink_id", id)
    .order("created_at")
    .returns<Comment[]>();

  const mine = drink.user_id === me.id;

  return (
    <div className="flex flex-col gap-4">
      <DrinkCard drink={drink} meId={me.id} linkToDetail={false} />

      {mine && (
        <form action={deleteDrink.bind(null, drink.id)} className="self-end">
          <ConfirmButton className="btn btn-danger px-3 py-1.5" message="Delete this drink?">
            Delete drink
          </ConfirmButton>
        </form>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Comments</h2>
        {(comments ?? []).length === 0 && (
          <p className="text-sm text-muted">No comments yet.</p>
        )}
        {(comments ?? []).map((c) => (
          <div key={c.id} className="flex gap-3">
            <Link href={`/u/${c.profile.username}`}>
              <Avatar profile={c.profile} size={32} />
            </Link>
            <div className="min-w-0 flex-1 rounded-2xl bg-surface-2 px-3 py-2">
              <div className="flex items-baseline gap-2 text-sm">
                <Link href={`/u/${c.profile.username}`} className="font-medium hover:underline">
                  {c.profile.display_name || c.profile.username}
                </Link>
                <span className="text-muted">{timeAgo(c.created_at)}</span>
                {(c.user_id === me.id || mine) && (
                  <form action={deleteComment.bind(null, c.id, drink.id)} className="ml-auto">
                    <button className="text-xs text-muted hover:text-danger">Delete</button>
                  </form>
                )}
              </div>
              <p className="whitespace-pre-wrap break-words text-sm">{c.body}</p>
            </div>
          </div>
        ))}
        <CommentForm drinkId={drink.id} />
      </section>
    </div>
  );
}
