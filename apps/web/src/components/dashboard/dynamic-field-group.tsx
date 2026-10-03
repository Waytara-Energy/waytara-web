import type { TemplateField, FieldValue } from "@/lib/template-field-format";
import type { EnumOption } from "@/lib/instrument-catalog-data";
import { MetricListCard } from "./metric-list-card";
import { groupByIndex } from "./indexed-group-card";
import { ComparisonStripCard } from "./comparison-strip-card";
import { PhaseMeterCard, groupByPhase } from "./phase-meter-card";

// A handful of known repeating-group prefixes get a real English item
// label ("Pack 3" reads better than "Battery_pack 3") — anything else
// falls back to a title-cased version of the prefix itself, so a future
// repeating group in the workbook still renders something reasonable with
// zero code changes here.
const ITEM_LABELS: Record<string, string> = {
  battery_pack: "Pack",
  pv_string: "String",
  pv: "PV Input",
  micro_panel: "Panel",
};

function itemLabelFor(prefix: string): string {
  if (ITEM_LABELS[prefix]) return ITEM_LABELS[prefix];
  const cleaned = prefix.replace(/_$/, "").replace(/_/g, " ");
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/** Renders one category/group_name slice of a dashboard section's fields —
 *  a PhaseMeterCard if every field is a per-phase electrical reading
 *  (Output Power/Voltage/Current × L1/L2/L3 and the like), a
 *  ComparisonStripCard if every field instead shares a repeating
 *  numbered-item shape (battery packs, PV strings, ...), a plain
 *  MetricListCard otherwise. This is the one place that decision gets
 *  made, so every dashboard page (Overview/Monitoring/Performance/...)
 *  renders its DB-driven field groups the same way without re-deciding it
 *  per page. */
export function DynamicFieldGroup({
  title,
  fields,
  getValue,
  enumOptionsByRef,
}: {
  title: string;
  fields: TemplateField[];
  getValue: (key: string) => FieldValue;
  enumOptionsByRef?: Map<string, EnumOption[]>;
}) {
  if (groupByPhase(fields)) {
    return <PhaseMeterCard title={title} fields={fields} getValue={getValue} />;
  }
  const grouped = groupByIndex(fields);
  if (grouped && grouped.items.size > 1) {
    return <ComparisonStripCard title={title} itemLabel={itemLabelFor(grouped.prefix)} fields={fields} getValue={getValue} />;
  }
  return <MetricListCard title={title} fields={fields} getValue={getValue} enumOptionsByRef={enumOptionsByRef} />;
}
