/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { CheersButton } from "@/components/CheersButton";
import { drinkMeta, formatStd, timeAgo } from "@/lib/drinks";
import type { FeedDrink } from "@/lib/types";

export function DrinkCard({
  drink,
  meId,
  linkToDetail = true,
}: {
  drink: FeedDrink;
  meId: string;
  linkToDetail?: boolean;
}) {
  const meta = drinkMeta(drink.drink_type);
  const p = drink.profile;
  const commentCount = drink.comments?.[0]?.count ?? 0;
  const cheered = drink.cheers.some((c) => c.user_id === meId);
  const title = drink.name || meta.label;

  return (
    <article className="card flex flex-col gap-3">
      <header className="flex items-center gap-3">
        <Link href={`/u/${p.username}`}>
          <Avatar profile={p} size={40} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/u/${p.username}`} className="font-medium hover:underline">
            {p.display_name || p.username}
          </Link>
          <div className="truncate text-sm text-muted">
            <time dateTime={drink.consumed_at} title={new Date(drink.consumed_at).toLocaleString()}>
              {timeAgo(drink.consumed_at)}
            </time>
            {drink.group && (
              <>
                {" · "}
                <Link href={`/groups/${drink.group.id}`} className="hover:underline">
                  {drink.group.name}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-2xl">
          {meta.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{title}</div>
          <div className="text-sm text-muted">
            {Number(drink.volume_ml)} ml · {Number(drink.abv)}% ABV
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold tabular-nums">{formatStd(drink.standard_drinks)}</div>
          <div className="text-xs text-muted">std drinks</div>
        </div>
      </div>

      {drink.notes && <p className="whitespace-pre-wrap text-sm">{drink.notes}</p>}

      {drink.photo_url && (
        <img
          src={drink.photo_url}
          alt={title}
          className="max-h-96 w-full rounded-xl object-cover"
          loading="lazy"
        />
      )}

      <footer className="flex items-center gap-2">
        <CheersButton drinkId={drink.id} count={drink.cheers.length} cheered={cheered} />
        {linkToDetail && (
          <Link href={`/drinks/${drink.id}`} className="tab">
            💬 {commentCount > 0 ? commentCount : "Comment"}
          </Link>
        )}
      </footer>
    </article>
  );
}
