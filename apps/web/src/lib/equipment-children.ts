// A customer's installation is a monitored device (inverter, EV charger) with child equipment under it (panels, battery,
// meters ...). Children have no readings and are not shown as devices; the dashboard reads them for what they say about the
// system. Pure functions - the database enforces the same split (waytara.is_monitored_category).

/** Stock categories that are devices with readings. Everything else is child equipment. */
export const MONITORED_CATEGORIES = ["solar_inverter", "ev_charger"] as const;

export function isMonitoredCategory(category: string | null | undefined): boolean {
  return (MONITORED_CATEGORIES as readonly string[]).includes(category ?? "");
}

/** One allocated child: its row and its stock record. */
export interface ChildEquipment {
  category: string | null;
  quantity: number;
  installedAt: string | null;
  capacityValue: number | string | null;
  capacityUnit: string | null;
  specs: Record<string, unknown> | null;
  warranty: Record<string, unknown> | null;
}

const toNumber = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

/** The installed solar size in kWp: every panel row's rated power x its quantity. Null when there are no panels, or a
 *  panel record that does not say its power. */
export function solarKwp(children: ChildEquipment[]): number | null {
  const panels = children.filter((c) => c.category === "Solar Panels");
  if (panels.length === 0) return null;
  let watts = 0;
  for (const p of panels) {
    const value = toNumber(p.capacityValue);
    if (value === null || value <= 0) return null;
    const unit = (p.capacityUnit ?? "W").toLowerCase();
    const perPanelW = unit === "kw" || unit === "kwp" ? value * 1000 : unit === "w" || unit === "wp" ? value : null;
    if (perPanelW === null) return null;
    watts += perPanelW * Math.max(1, p.quantity);
  }
  return Number((watts / 1000).toFixed(3));
}
