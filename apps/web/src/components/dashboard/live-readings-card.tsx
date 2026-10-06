import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatFieldValue, type TemplateField, type FieldValue } from "@/lib/template-field-format";
import { lookupEnumLabel, type EnumOption } from "@/lib/enum-labels";
import { Meter } from "./meter";
import { RadialMeter } from "./radial-meter";

type Tone = "good" | "warn" | "bad" | "neutral";

// Keyword-driven, not a hand-curated map of every enum_ref this app has —
// equipment_enum spans every device/vendor's own fault/state vocabulary, so
// a fixed code->tone table would need constant upkeep and still miss a new
// device's wording. Matched against the *resolved label text*, not the raw
// code, so it reads the same words a person would.
const BAD_WORDS = /\b(fault|faulted|error|fail(?:ed|ure)?|trip(?:ped)?|alarm|disconnect(?:ed)?|absent|unlock(?:ed)?|stop(?:ped)?|lost|unavailable|unhealthy|open|low)\b/i;
const GOOD_WORDS = /\b(ok|okay|normal|good|ready|connected|complete(?:d)?|available|pass(?:ed)?|yes|active|closed|locked|healthy|charging|present|high)\b/i;

function inferTone(text: string): Tone {
  if (BAD_WORDS.test(text)) return "bad";
  if (GOOD_WORDS.test(text)) return "good";
  return "neutral";
}

const TONE_CHIP_CLASS: Record<Tone, string> = {
  good: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  warn: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  bad: "bg-destructive/15 text-destructive",
  neutral: "bg-muted text-muted-foreground",
};

function isStatusField(field: TemplateField): boolean {
  return field.valueKind === "enum" || field.valueKind === "bool" || field.unit === "bool";
}

function isPercentField(field: TemplateField): boolean {
  return field.unit === "%";
}

function statusText(field: TemplateField, raw: FieldValue, enumOptionsByRef?: Map<string, EnumOption[]>): string {
  if (field.valueKind === "enum" && field.enumRef && enumOptionsByRef) {
    return lookupEnumLabel(enumOptionsByRef, field.enumRef, raw as string | number | null) ?? "—";
  }
  if (raw === null || raw === undefined) return "—";
  return Number(raw) === 1 || raw === "true" ? "Yes" : "No";
}

// Pairs a live reading with its own rated/limit sibling in the *same*
// group — e.g. dc_output_power_kw <-> evse_max_power_kw — so that one
// specific relationship can render as a real "ratio against a limit"
// meter instead of a bare number. Deliberately conservative: only pairs
// when there's exactly one same-unit "max" candidate sharing the same
// quantity word. A field with two plausible limits (BMS's charge vs.
// discharge current ceilings, say) has no honest single ratio to show, so
// it's left unpaired on purpose rather than guessing which one applies —
// both the reading and both limits still show as their own stat tiles.
const QUANTITY_WORDS = ["voltage", "current", "power"];

function findLimitPairs(fields: TemplateField[]): Map<string, TemplateField> {
  const pairs = new Map<string, TemplateField>();
  for (const base of fields) {
    if (/max/i.test(base.key) || isStatusField(base) || isPercentField(base)) continue;
    const quantity = QUANTITY_WORDS.find((w) => base.key.includes(w));
    if (!quantity) continue;
    const candidates = fields.filter((f) => f !== base && /max/i.test(f.key) && f.key.includes(quantity) && f.unit === base.unit);
    if (candidates.length === 1) pairs.set(base.key, candidates[0]);
  }
  return pairs;
}

/** The catch-all for a group that's mostly live status/readings rather
 *  than a repeating item or a clean per-phase triplet — a fault/connection
 *  status (Inverter/Grid Status), a cluster of live values with a couple
 *  of state fields mixed in (Battery Live, Connector & Safety, BMS, EV DC
 *  Output), or any mix of the two. Renders in four tiers, most urgent
 *  first: status chips (something's wrong or not — read this before any
 *  number) -> percent rings (the one shape with a true 0–100 ceiling) ->
 *  paired meters (a reading that *does* have a real limit alongside it) ->
 *  plain stat tiles for everything else. A tier that's empty for this
 *  group simply doesn't render, so a pure-status group (just Inverter
 *  Status's one field) reads as a single clear chip, not an empty card
 *  shell around it. */
export function LiveReadingsCard({
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
  if (fields.length === 0) return null;

  const statusFields = fields.filter(isStatusField);
  const nonStatus = fields.filter((f) => !isStatusField(f));
  const percentFields = nonStatus.filter(isPercentField);
  const rest = nonStatus.filter((f) => !isPercentField(f));
  const limitPairs = findLimitPairs(rest);
  const pairedFields = rest.filter((f) => limitPairs.has(f.key));
  const plainFields = rest.filter((f) => !limitPairs.has(f.key) && !Array.from(limitPairs.values()).includes(f));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {statusFields.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {statusFields.map((field) => {
              const text = statusText(field, getValue(field.key), enumOptionsByRef);
              const tone = inferTone(text);
              return (
                <div
                  key={field.key}
                  className="flex min-w-[9rem] flex-1 items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2"
                >
                  <span className="truncate text-xs text-muted-foreground">{field.label}</span>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize", TONE_CHIP_CLASS[tone])}>
                    {text}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {percentFields.length > 0 && (
          <div className="flex flex-wrap justify-center gap-6 py-1 sm:justify-start">
            {percentFields.map((field) => {
              const raw = getValue(field.key);
              const num = typeof raw === "number" ? raw : null;
              return (
                <RadialMeter
                  key={field.key}
                  label={field.label}
                  valueText={formatFieldValue(raw, field)}
                  fraction={num !== null ? num / 100 : 0}
                  tone={num !== null && num < 20 ? "bad" : "accent"}
                />
              );
            })}
          </div>
        )}

        {pairedFields.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {pairedFields.map((field) => {
              const limit = limitPairs.get(field.key)!;
              const raw = getValue(field.key);
              const limitRaw = getValue(limit.key);
              const num = typeof raw === "number" ? raw : null;
              const limitNum = typeof limitRaw === "number" ? limitRaw : null;
              const fraction = num !== null && limitNum ? num / limitNum : 0;
              return (
                <Meter
                  key={field.key}
                  label={`${field.label} · limit ${formatFieldValue(limitRaw, limit)}`}
                  value={formatFieldValue(raw, field)}
                  fraction={fraction}
                  tone={fraction > 0.9 ? "warn" : "accent"}
                />
              );
            })}
          </div>
        )}

        {plainFields.length > 0 && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            {plainFields.map((field) => (
              <div key={field.key} className="space-y-0.5">
                <p className="truncate text-xs text-muted-foreground">{field.label}</p>
                <p className="truncate text-base font-semibold tabular-nums text-foreground">{formatFieldValue(getValue(field.key), field)}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
