import { TEMPERATURE_MAX_C } from "./temperature-thresholds";
import type { TemplateField } from "./template-field-format";
import type { HeatmapRow } from "@/components/dashboard/temperature-heatmap";

/** Builds a TemperatureHeatmap's `rows` from a CategorySection's own
 *  fetched fields instead of a hardcoded key/label pair — the label is
 *  always this device's real equipment_templates.display_name, never
 *  invented copy that can drift from (or just plain not match) what the
 *  field actually is. Only picks fields this lookup has a ceiling for, so
 *  a group with non-temperature fields mixed in (e.g. Battery > Live)
 *  can't accidentally feed something else into a °C color scale. */
export function temperatureRowsFor(fields: TemplateField[]): HeatmapRow[] {
  return fields
    .filter((f) => f.key in TEMPERATURE_MAX_C)
    .map((f) => ({ key: f.key, label: f.label, maxC: TEMPERATURE_MAX_C[f.key] }));
}
