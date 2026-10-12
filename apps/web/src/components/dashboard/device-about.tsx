import { BatteryCharging, Cpu, EvCharger, Package, Sun, type LucideIcon } from "lucide-react";
import type { AboutKind, AboutPageData, AboutRow } from "@/lib/device-about";
import { DeviceCard, type CardTone } from "./device-card";

/** The icon of each kind of equipment, the same as on the Performance and Monitoring tabs. */
export const KIND_ICON: Record<AboutKind, LucideIcon> = { inverter: Cpu, charger: EvCharger, panel: Sun, battery: BatteryCharging, other: Package };
export const KIND_TONE: Record<AboutKind, CardTone> = { inverter: "primary", charger: "primary", panel: "amber", battery: "emerald", other: "neutral" };

/** Rows of a card: the name on the left, the value on the right, a thin line between. Rows with no value are left out. */
export function AboutRows({ rows }: { rows: AboutRow[] }) {
  const shown = rows.filter((r): r is [string, string] => r[1] !== null && r[1] !== undefined && r[1] !== "");
  return (
    <dl>
      {shown.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-6 border-b border-border/60 py-2.5 text-sm first:pt-0 last:border-b-0 last:pb-0">
          <dt className="shrink-0 text-muted-foreground">{label}</dt>
          <dd className="min-w-0 break-words text-right font-medium text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

const hasRows = (rows: AboutRow[]) => rows.some((r) => r[1] !== null && r[1] !== undefined && r[1] !== "");

/** One block of facts as a card. Nothing is drawn when the block has no value to show. */
export function AboutSection({ title, description, rows, className }: { title: string; description?: string; rows: AboutRow[]; className?: string }) {
  if (!hasRows(rows)) return null;
  return (
    <DeviceCard title={title} description={description} className={className}>
      <AboutRows rows={rows} />
    </DeviceCard>
  );
}

/** One piece of equipment: a heading with its name and model, and its facts as cards below. */
export function DeviceAbout({ page }: { page: AboutPageData }) {
  const subtitle = [page.title, page.subtitle].filter((v, i, a) => v && a.indexOf(v) === i).join(" · ");
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-theme-primary">{page.menuLabel}</h2>
        {subtitle && <p className="mt-1 text-sm text-theme-muted">{subtitle}</p>}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {page.sections.map((s) => (
          <AboutSection key={s.title} title={s.title} rows={s.rows} />
        ))}
      </div>
    </section>
  );
}
