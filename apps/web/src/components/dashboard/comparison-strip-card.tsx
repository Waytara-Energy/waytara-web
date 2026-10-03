import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFieldValue, type TemplateField, type FieldValue } from "@/lib/template-field-format";
import { groupByIndex, type IndexedField } from "./indexed-group-card";

interface HeadlineEntry {
  index: number;
  field: TemplateField;
  raw: FieldValue;
  num: number | null;
}

// Which sub-field leads the ranked comparison, in priority order — power is
// the headline for anything that generates/draws it (PV strings), state of
// charge for anything that stores it (battery packs); the first match
// found among an item's own sub-fields wins, so a repeating group this
// list doesn't anticipate still gets a sensible headline rather than none.
const HEADLINE_SUFFIX_PRIORITY = ["_power_w", "_soc_pct", "_voltage_v", "_current_a"];

function pickHeadlineSubKey(subKeys: string[]): string | null {
  for (const suffix of HEADLINE_SUFFIX_PRIORITY) {
    const found = subKeys.find((k) => k === suffix);
    if (found) return found;
  }
  return subKeys[0] ?? null;
}

/** A repeating-item group (PV strings, battery packs, microinverter
 *  modules...) as a ranked comparison first, full per-item detail second —
 *  the headline question for a repeating group is almost always "which one
 *  stands out" (a weak string, an imbalanced pack), and a sorted strip of
 *  inline bars answers that at a glance in a way a plain grid of
 *  same-sized item boxes can't; the full detail grid still follows
 *  underneath for whoever wants every sub-field of a specific item, just
 *  demoted below the headline view instead of leading it. */
export function ComparisonStripCard({
  title,
  itemLabel,
  fields,
  getValue,
}: {
  title: string;
  itemLabel: string;
  fields: TemplateField[];
  getValue: (key: string) => FieldValue;
}) {
  const grouped = groupByIndex(fields);
  if (!grouped || grouped.items.size === 0) return null;

  const sortedIndices = Array.from(grouped.items.keys()).sort((a, b) => a - b);
  const subKeys = (grouped.items.get(sortedIndices[0]) ?? []).map((f: IndexedField) => f.subKey);
  const headlineSubKey = pickHeadlineSubKey(subKeys);

  const headline: HeadlineEntry[] = headlineSubKey
    ? sortedIndices
        .map((index): HeadlineEntry | null => {
          const match = grouped.items.get(index)!.find((f: IndexedField) => f.subKey === headlineSubKey);
          if (!match) return null;
          const raw = getValue(match.field.key);
          return { index, field: match.field, raw, num: typeof raw === "number" ? raw : null };
        })
        .filter((v): v is HeadlineEntry => v !== null)
        .sort((a, b) => (b.num ?? -Infinity) - (a.num ?? -Infinity))
    : [];
  const maxValue = Math.max(...headline.map((h) => h.num ?? 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {headline.length > 0 && (
          <div className="space-y-2">
            {headline.map(({ index, field, raw, num }) => (
              <div key={index} className="flex items-center gap-3 text-sm">
                <span className="w-20 shrink-0 truncate text-muted-foreground">
                  {itemLabel} {index}
                </span>
                <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500"
                    style={{ width: `${maxValue > 0 && num !== null ? Math.max(2, (num / maxValue) * 100) : 0}%` }}
                  />
                </div>
                <span className="w-20 shrink-0 text-right font-medium tabular-nums text-foreground">{formatFieldValue(raw, field)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedIndices.map((index) => (
            <div key={index} className="space-y-1.5 rounded-lg border border-border p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {itemLabel} {index}
              </p>
              {grouped.items.get(index)!.map(({ field }) => (
                <div key={field.key} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{field.label}</span>
                  <span className="font-medium text-foreground">{formatFieldValue(getValue(field.key), field)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
