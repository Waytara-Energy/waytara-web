import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFieldValue, type TemplateField, type FieldValue } from "@/lib/template-field-format";
import { lookupEnumLabel, type EnumOption } from "@/lib/instrument-catalog-data";

// Durations arrive in raw seconds (session_duration_s and the like) —
// formatFieldValue has no unit-aware special case for "s" (it's not a
// currency/timestamp/bool, just a plain number), so left alone it reads as
// "5400 s" instead of "1h 30m". This is the one unit this card reformats
// itself rather than deferring to the shared formatter.
function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function displayValue(field: TemplateField, raw: FieldValue, enumOptionsByRef?: Map<string, EnumOption[]>): string {
  if (field.unit === "s" && typeof raw === "number") return formatDuration(raw);
  if (field.valueKind === "enum" && field.enumRef && enumOptionsByRef) {
    return lookupEnumLabel(enumOptionsByRef, field.enumRef, raw as string | number | null) ?? "—";
  }
  if ((field.valueKind === "bool" || field.unit === "bool") && raw !== null && raw !== undefined) {
    return Number(raw) === 1 || raw === "true" ? "Yes" : "No";
  }
  return formatFieldValue(raw, field);
}

export interface ReceiptSection {
  title: string;
  fields: TemplateField[];
}

/** EV Session/Vehicle/Authorization/Billing — a ride-receipt shape (think
 *  a charging-app's own session summary) instead of four more flat-list
 *  cards: durations read as "1h 30m" not raw seconds, each sub-section
 *  gets its own small heading so the page doesn't need four separate card
 *  shells for what's really one story ("what happened this session"), and
 *  sections render in whatever priority order the caller passes — the
 *  live Session detail first, Vehicle/Authorization/Billing after, same
 *  "most urgent first" ordering as every other panel on this page. */
export function SessionReceiptCard({
  title,
  sections,
  getValue,
  enumOptionsByRef,
}: {
  title: string;
  sections: ReceiptSection[];
  getValue: (key: string) => FieldValue;
  enumOptionsByRef?: Map<string, EnumOption[]>;
}) {
  const nonEmpty = sections.filter((s) => s.fields.length > 0);
  if (nonEmpty.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {nonEmpty.map((section, i) => (
          <div key={section.title} className={i > 0 ? "space-y-2 border-t border-border pt-4" : "space-y-2"}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{section.title}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              {section.fields.map((field) => (
                <div key={field.key} className="space-y-0.5">
                  <p className="truncate text-xs text-muted-foreground">{field.label}</p>
                  <p className="truncate text-base font-semibold tabular-nums text-foreground">
                    {displayValue(field, getValue(field.key), enumOptionsByRef)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
