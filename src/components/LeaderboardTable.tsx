import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { formatStd } from "@/lib/drinks";
import type { LeaderboardRow } from "@/lib/types";

const MEDALS = ["🥇", "🥈", "🥉"];

export function LeaderboardTable({ rows, meId }: { rows: LeaderboardRow[]; meId: string }) {
  if (rows.length === 0) {
    return (
      <div className="card py-8 text-center text-muted">No drinks logged in this period yet.</div>
    );
  }
  return (
    <ol className="flex flex-col gap-2">
      {rows.map((r, i) => (
        <li key={r.user_id}>
          <Link
            href={`/u/${r.username}`}
            className={`card flex items-center gap-3 hover:bg-surface-2 ${
              r.user_id === meId ? "border-accent" : ""
            }`}
          >
            <span className="w-7 text-center text-lg font-bold tabular-nums text-muted">
              {MEDALS[i] ?? i + 1}
            </span>
            <Avatar profile={r} size={36} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">
                {r.display_name || r.username}
                {r.user_id === meId && <span className="text-muted"> (you)</span>}
              </div>
              <div className="truncate text-sm text-muted">
                {r.drink_count} {Number(r.drink_count) === 1 ? "drink" : "drinks"}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold tabular-nums">{formatStd(r.total_standard)}</div>
              <div className="text-xs text-muted">std drinks</div>
            </div>
          </Link>
        </li>
      ))}
    </ol>
  );
}
