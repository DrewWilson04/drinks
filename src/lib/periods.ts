export const PERIODS = [
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "all", label: "All time" },
] as const;

export type Period = (typeof PERIODS)[number]["value"];

export function parsePeriod(p: string | undefined): Period {
  return PERIODS.some((x) => x.value === p) ? (p as Period) : "7d";
}
