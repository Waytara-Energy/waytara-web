import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFieldValue, type TemplateField, type FieldValue } from "@/lib/template-field-format";
import { Meter } from "./meter";

type Phase = "1" | "2" | "3";

// Measurement-word ordering — Power leads (it's the headline number for
// most readers), Voltage/Current follow, anything else keeps whatever
// order it was discovered in. Matched against the *measurement key*
// (base+suffix, see parsePhaseKey), not a fixed enum, since different
// vendors spell "power" differently in their own register names
// (inverter_l1_power_w vs. power_active_import_l1_kw).
const MEASUREMENT_WORD_ORDER = ["power", "voltage", "current"];

interface PhaseEntry {
  phase: Phase;
  field: TemplateField;
}

interface PhaseMeasurement {
  key: string;
  phases: PhaseEntry[];
}

export interface PhaseGroupData {
  measurements: PhaseMeasurement[];
  /** Everything in the source group that *isn't* part of the per-phase
   *  shape — a real equipment_templates group bundling L1/L2/L3 readings
   *  (e.g. "AC output") near-always also carries non-phase fields like a
   *  total or a frequency, so this is almost always non-empty; the caller
   *  renders these as a plain row list under the meters instead of
   *  dropping them. */
  restFields: TemplateField[];
}

/** A key's own measurement identity with the phase number lifted out —
 *  "inverter_l1_power_w" and "inverter_l2_power_w" both become
 *  `{measurementKey: "inverter::power_w", phase}`, so they group as the
 *  same measurement's L1/L2 readings regardless of which vendor's naming
 *  convention produced them. Two real conventions exist in this catalog:
 *  the phase marker sitting *before* the unit (solar/grid/load's
 *  "inverter_l1_power_w" — base "inverter", suffix "power_w") and the
 *  phase marker sitting *after* a measurement word that's itself the base
 *  (the EV energy meter's "current_import_l1_a" — base
 *  "current_import", suffix "a"); both fall out of the same
 *  `{base}_l{N}_{suffix}` shape, just with the "which word carries the
 *  measurement" line drawn in a different place — this doesn't need to
 *  tell them apart, only that base+suffix together still uniquely name
 *  one measurement. */
function parsePhaseKey(key: string): { measurementKey: string; phase: Phase } | null {
  // Excludes line-to-line readings (e.g. "inverter_l1_l2_voltage_v",
  // "voltage_l1_l2_v") before the main pattern ever gets a chance at
  // them — the trailing "_l2_..." would otherwise match as if it were
  // plain L2, silently merging a genuinely different measurement
  // (line-to-line, not line-to-neutral) into that phase's meter.
  if (/_l[123]_l[123]_/.test(key)) return null;
  const match = key.match(/^(.+)_l([123])_(.+)$/);
  if (!match) return null;
  const [, base, phaseStr, suffix] = match;
  return { measurementKey: `${base}::${suffix}`, phase: phaseStr as Phase };
}

/** Splits `fields` into its per-phase electrical subset (Output Power/
 *  Voltage/Current × L1/L2/L3 and the like) plus everything else — unlike
 *  groupByIndex's all-or-nothing match, a real equipment_templates group
 *  almost always bundles a few non-phase fields (a total, a frequency,
 *  apparent/reactive power) alongside the phase-shaped ones, so requiring
 *  every field to match would mean this never fires on real data. Each
 *  *measurement* (not the whole group) only needs 2+ of its own phases
 *  present to count — a group that mixes several differently-prefixed
 *  measurements (the EV energy meter's current_import_l*_a alongside
 *  power_active_import_l*_kw) still groups each one correctly instead of
 *  only recognizing whichever measurement happens to share the first
 *  matched field's own prefix. Returns null only when no measurement in
 *  the group clears that 2-phase bar. */
export function groupByPhase(fields: TemplateField[]): PhaseGroupData | null {
  const parsed = fields.map((field) => {
    const p = parsePhaseKey(field.key);
    return p ? { field, ...p } : null;
  });
  const matched = parsed.filter((p): p is { field: TemplateField; measurementKey: string; phase: Phase } => p !== null);
  if (matched.length === 0) return null;

  const byMeasurement = new Map<string, PhaseEntry[]>();
  for (const p of matched) {
    const list = byMeasurement.get(p.measurementKey) ?? [];
    list.push({ phase: p.phase, field: p.field });
    byMeasurement.set(p.measurementKey, list);
  }
  for (const list of byMeasurement.values()) {
    list.sort((a, b) => a.phase.localeCompare(b.phase));
  }

  const validKeys = [...byMeasurement.keys()].filter((k) => new Set(byMeasurement.get(k)!.map((e) => e.phase)).size >= 2);
  if (validKeys.length === 0) return null;

  const consistentKeys = new Set(validKeys.flatMap((k) => byMeasurement.get(k)!.map((e) => e.field.key)));
  const restFields = fields.filter((f) => !consistentKeys.has(f.key));

  const ordered = validKeys.sort((a, b) => {
    const wordIndex = (k: string) => MEASUREMENT_WORD_ORDER.findIndex((w) => k.toLowerCase().includes(w));
    const ai = wordIndex(a);
    const bi = wordIndex(b);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return { measurements: ordered.map((key) => ({ key, phases: byMeasurement.get(key)! })), restFields };
}

// "Output Power L1" -> "Output Power", "Voltage L1-N" -> "Voltage" —
// strips the trailing phase marker (a bare "L1", or a line-to-neutral
// "L1-N") off the field's own real display_name instead of inventing new
// copy; every measurement's label still comes straight from
// equipment_templates.
function measurementLabel(field: TemplateField): string {
  return field.label.replace(/\s*L[123](-[A-Za-z]+)?\s*$/i, "");
}

const PHASE_LABELS: Record<Phase, string> = { "1": "L1", "2": "L2", "3": "L3" };

/** One measurement's phase comparison — a meter per phase present, scaled
 *  against the largest reading among them so three phases sit on one
 *  shared scale instead of each having its own, and a phase reading near
 *  zero (a single-phase install's unused L2/L3) visibly collapses rather
 *  than guessing a value. Three slim meters read the imbalance between
 *  phases at a glance the way the old pie/rose treatment couldn't — a
 *  wedge's *angle* can't carry magnitude without distorting the other two,
 *  where a meter's fill length reads directly as "how much," phase to
 *  phase, on one line. */
function PhaseMeasurementRow({
  label,
  phases,
}: {
  label: string;
  phases: { phase: Phase; value: FieldValue; formatted: string }[];
}) {
  const maxValue = Math.max(...phases.map((p) => (typeof p.value === "number" ? Math.abs(p.value) : 0)), 0);
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-3">
        {phases.map((p) => {
          const v = typeof p.value === "number" ? Math.abs(p.value) : 0;
          return (
            <Meter
              key={p.phase}
              label={PHASE_LABELS[p.phase]}
              value={p.formatted}
              fraction={maxValue > 0 ? v / maxValue : 0}
              size="sm"
            />
          );
        })}
      </div>
    </div>
  );
}

/** Per-phase electrical data (Output Power/Voltage/Current × L1/L2/L3 and
 *  the like) as one meter row per measurement instead of 9 flat rows —
 *  DynamicFieldGroup routes here automatically whenever a group's fields
 *  match groupByPhase's shape, the same dispatch-by-shape pattern it
 *  already uses for ComparisonStripCard's repeating-item shape. */
export function PhaseMeterCard({
  title,
  fields,
  getValue,
}: {
  title: string;
  fields: TemplateField[];
  getValue: (key: string) => FieldValue;
}) {
  const grouped = groupByPhase(fields);
  if (!grouped) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {grouped.measurements.map((measurement) => (
          <PhaseMeasurementRow
            key={measurement.key}
            label={measurementLabel(measurement.phases[0].field)}
            phases={measurement.phases.map(({ phase, field }) => {
              const raw = getValue(field.key);
              return { phase, value: raw, formatted: formatFieldValue(raw, field) };
            })}
          />
        ))}

        {grouped.restFields.length > 0 && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-4 sm:grid-cols-3">
            {grouped.restFields.map((field) => (
              <div key={field.key} className="space-y-0.5">
                <p className="truncate text-xs text-muted-foreground">{field.label}</p>
                <p className="truncate text-sm font-semibold tabular-nums text-foreground">{formatFieldValue(getValue(field.key), field)}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
