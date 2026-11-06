"use client";

import { useEffect, useMemo, useState } from "react";
import { DRINK_TYPES, drinkMeta, formatStd } from "@/lib/drinks";
import type { DrinkType } from "@/lib/types";

export type StatRow = {
  consumed_at: string;
  standard_drinks: number;
  drink_type: DrinkType;
};

const DAY = 86400_000;

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function StatsView({ rows, compact = false }: { rows: StatRow[]; compact?: boolean }) {
  // Compute in the browser so "today" and day boundaries use the viewer's zone.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  const stats = useMemo(() => {
    if (!now) return null;
    const today = startOfDay(now);
    const sum = (since: number) =>
      rows
        .filter((r) => new Date(r.consumed_at).getTime() >= since)
        .reduce((s, r) => s + Number(r.standard_drinks), 0);

    const byDay = new Map<string, { std: number; count: number }>();
    for (const r of rows) {
      const k = dayKey(new Date(r.consumed_at));
      const v = byDay.get(k) ?? { std: 0, count: 0 };
      v.std += Number(r.standard_drinks);
      v.count += 1;
      byDay.set(k, v);
    }

    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(today.getTime() - (29 - i) * DAY);
      // Re-anchor in case of DST shifts.
      const anchored = startOfDay(new Date(d.getTime() + DAY / 2));
      const v = byDay.get(dayKey(anchored)) ?? { std: 0, count: 0 };
      return { date: anchored, ...v };
    });

    const byType = new Map<DrinkType, { std: number; count: number }>();
    for (const r of rows) {
      const v = byType.get(r.drink_type) ?? { std: 0, count: 0 };
      v.std += Number(r.standard_drinks);
      v.count += 1;
      byType.set(r.drink_type, v);
    }
    const types = DRINK_TYPES.map((t) => ({ ...t, ...(byType.get(t.type) ?? { std: 0, count: 0 }) }))
      .filter((t) => t.count > 0)
      .sort((a, b) => b.std - a.std);

    const total = rows.reduce((s, r) => s + Number(r.standard_drinks), 0);
    const drinkingDays = byDay.size;

    return {
      today: sum(today.getTime()),
      week: sum(today.getTime() - 6 * DAY),
      month: sum(today.getTime() - 29 * DAY),
      total,
      count: rows.length,
      drinkingDays,
      perDrinkingDay: drinkingDays ? total / drinkingDays : 0,
      days,
      types,
      favorite: types.slice().sort((a, b) => b.count - a.count)[0],
    };
  }, [rows, now]);

  if (!stats) return <div className="h-40" aria-busy />;

  const tiles = compact
    ? [
        ["Last 7 days", formatStd(stats.week), "std drinks"],
        ["Last 30 days", formatStd(stats.month), "std drinks"],
        ["Drinks logged", String(stats.count), "all time"],
      ]
    : [
        ["Today", formatStd(stats.today), "std drinks"],
        ["Last 7 days", formatStd(stats.week), "std drinks"],
        ["Last 30 days", formatStd(stats.month), "std drinks"],
        ["All time", formatStd(stats.total), `${stats.count} drinks`],
        ["Drinking days", String(stats.drinkingDays), "all time"],
        ["Per drinking day", formatStd(stats.perDrinkingDay), "std drinks avg"],
      ];

  return (
    <div className="flex flex-col gap-4">
      <div className={`grid gap-3 ${compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3"}`}>
        {tiles.map(([label, value, sub]) => (
          <div key={label} className="card">
            <div className="text-xs text-muted">{label}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
            <div className="text-xs text-muted">{sub}</div>
          </div>
        ))}
      </div>

      <DailyChart days={stats.days} />

      {!compact && stats.types.length > 0 && (
        <section className="card">
          <h3 className="font-semibold">By type</h3>
          <p className="text-xs text-muted">
            Standard drinks, all time
            {stats.favorite && ` · most logged: ${drinkMeta(stats.favorite.type).emoji} ${stats.favorite.label}`}
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {stats.types.map((t) => (
              <li key={t.type} className="grid grid-cols-[7rem_1fr_3.5rem] items-center gap-2 text-sm">
                <span className="truncate">{t.emoji} {t.label}</span>
                <span className="h-3 rounded-r bg-surface-2">
                  <span
                    className="block h-3 rounded-r bg-accent"
                    style={{ width: `${(t.std / stats.types[0].std) * 100}%` }}
                    title={`${t.label}: ${formatStd(t.std)} std drinks from ${t.count} drinks`}
                  />
                </span>
                <span className="text-right tabular-nums text-muted">{formatStd(t.std)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function DailyChart({ days }: { days: { date: Date; std: number; count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.std));
  const niceMax = Math.ceil(max);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const active = hover !== null ? days[hover] : null;

  return (
    <section className="card">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold">Standard drinks per day</h3>
        <span className="text-xs text-muted">last 30 days</span>
      </div>
      <div className="mt-1 h-5 text-sm tabular-nums" aria-live="polite">
        {active ? (
          <>
            <span className="font-medium">{fmt(active.date)}</span>
            <span className="text-muted">
              {" · "}{formatStd(active.std)} std drinks · {active.count} {active.count === 1 ? "drink" : "drinks"}
            </span>
          </>
        ) : (
          <span className="text-muted">Hover or tap a bar for details</span>
        )}
      </div>
      <div className="relative mt-2 h-36">
        {/* recessive gridlines */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          <div className="border-t border-dashed border-border" />
          <div className="border-t border-dashed border-border" />
          <div className="border-t border-border" />
        </div>
        <span className="absolute -top-2 right-0 bg-surface pl-1 text-[10px] text-muted tabular-nums">
          {niceMax}
        </span>
        <div
          className="relative flex h-full items-end gap-[2px]"
          onMouseLeave={() => setHover(null)}
        >
          {days.map((d, i) => (
            <button
              key={i}
              type="button"
              className="group flex h-full flex-1 items-end focus:outline-none"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onClick={() => setHover(i)}
              aria-label={`${fmt(d.date)}: ${formatStd(d.std)} standard drinks`}
            >
              <span
                className={`block w-full rounded-t-[4px] transition-colors ${
                  hover === i ? "bg-accent-strong" : "bg-accent"
                } ${d.std === 0 ? "opacity-0" : ""}`}
                style={{ height: `${(d.std / niceMax) * 100}%`, minHeight: d.std > 0 ? 3 : 0 }}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>{fmt(days[0].date)}</span>
        <span>{fmt(days[14].date)}</span>
        <span>Today</span>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-muted">Show as table</summary>
        <table className="mt-2 w-full text-left tabular-nums">
          <thead className="text-muted">
            <tr><th className="font-normal">Day</th><th className="font-normal">Drinks</th><th className="font-normal">Std drinks</th></tr>
          </thead>
          <tbody>
            {days.filter((d) => d.count > 0).reverse().map((d) => (
              <tr key={d.date.toISOString()} className="border-t border-border">
                <td className="py-1">{fmt(d.date)}</td><td>{d.count}</td><td>{formatStd(d.std)}</td>
              </tr>
            ))}
            {days.every((d) => d.count === 0) && (
              <tr><td colSpan={3} className="py-1 text-muted">No drinks in the last 30 days.</td></tr>
            )}
          </tbody>
        </table>
      </details>
    </section>
  );
}
