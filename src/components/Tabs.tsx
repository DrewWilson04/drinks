import Link from "next/link";

export function Tabs({
  items,
  active,
}: {
  items: { href: string; label: string; value: string }[];
  active: string;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((t) => (
        <Link
          key={t.value}
          href={t.href}
          className={`tab ${t.value === active ? "tab-active" : ""}`}
          scroll={false}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
