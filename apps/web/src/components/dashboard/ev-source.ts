import { BatteryCharging, Sun, Zap } from "lucide-react";
import type { SourceShare } from "@/lib/ev-sessions";

/** The source of a charge's energy: the source bar's own colours (not the energy flow's): the sun's warm yellow, a calm teal for the battery, indigo for the grid. */
export const SOURCE = {
  solar: { icon: Sun, color: "#fbbf24" },
  battery: { icon: BatteryCharging, color: "#14b8a6" },
  grid: { icon: Zap, color: "#6366f1" },
  unattributed: { icon: Zap, color: "var(--border)" },
} as const;

/**
 * What the site's meters could not place (the charge's "not measured" energy) is shown as solar: on these sites the solar meter is the one that is not
 * reporting, so the rest of the energy is the sun's. The shares are worked out again over the same total (they still add up to 100).
 */
export function unknownAsSolar(shares: SourceShare[] | null): SourceShare[] | null {
  if (!shares) return null;
  const unknown = shares.find((s) => s.key === "unattributed");
  if (!unknown) return shares;
  const total = shares.reduce((a, s) => a + s.kwh, 0);
  const rest = shares.filter((s) => s.key !== "unattributed");
  const solar = rest.find((s) => s.key === "solar");
  const merged = solar
    ? rest.map((s) => (s.key === "solar" ? { ...s, kwh: s.kwh + unknown.kwh, pct: total > 0 ? ((s.kwh + unknown.kwh) / total) * 100 : s.pct + unknown.pct } : s))
    : [{ key: "solar" as const, label: "Solar", kwh: unknown.kwh, pct: unknown.pct }, ...rest];
  return merged;
}
