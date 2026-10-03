import { Card, CardContent } from "@/components/ui/card";
import { formatFieldValue, type TemplateField } from "@/lib/template-field-format";

// The Overview dashboard_section's own 4 "today" totals (see
// device-overview.ts's TODAY_ENERGY_KEYS, fetched alongside this same
// `get`/`enabledKeys` pair) — a small, fixed set of well-known keys, not
// the fully dynamic per-device field list template-fields.ts's
// fetchDashboardFields drives elsewhere, since this card's whole point is
// always showing the same four totals in the same order. Order only —
// each field's own label/unit comes from `fields` (the caller's real
// equipment_templates.display_name for this device), never hardcoded here,
// so this card can't drift from what Monitoring's own copy of the same
// field calls it.
const TODAY_KEY_ORDER = ["day_pv_energy_kwh", "day_grid_import_energy_kwh", "day_grid_export_energy_kwh", "day_load_energy_kwh"];

/** Shared by the site Overview page and a device's own detail page —
 *  both render this exact "today's totals" tile grid for whichever
 *  device is currently in view. `enabledKeys` filters out any field this
 *  device's own equipment_metrics doesn't actually confirm exist — hides
 *  the whole card if none of them do. */
export function TodaySoFar({
  fields: allFields,
  get,
  enabledKeys,
}: {
  fields: TemplateField[];
  get: (key: string) => number | null;
  enabledKeys: Set<string>;
}) {
  const byKey = new Map(allFields.map((f) => [f.key, f]));
  const fields = TODAY_KEY_ORDER.map((k) => byKey.get(k)).filter((f): f is TemplateField => f !== undefined && enabledKeys.has(f.key));
  if (fields.length === 0) return null;
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-foreground">Today so far</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {fields.map((field) => (
          <Card key={field.key}>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{field.label}</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{formatFieldValue(get(field.key), field)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
