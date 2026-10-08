// A customer's installation is a monitored device (inverter, EV charger) with child equipment under it (panels, battery,
// meters ...). The same split as waytara.is_monitored_category in the database.
export const MONITORED_CATEGORIES = ["solar_inverter", "ev_charger"] as const;

export function isMonitoredCategory(category: string | null | undefined): boolean {
  return (MONITORED_CATEGORIES as readonly string[]).includes(category ?? "");
}
