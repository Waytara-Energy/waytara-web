import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFieldValue, type TemplateField, type FieldValue } from "@/lib/template-field-format";

// "Today"/"Day" figures lead (what changed since midnight is the
// actionable number); a lifetime/total figure is context, not news, so it
// trails even though both render at the same stat-tile size — order here
// is the tie-break when a group mixes the two, not a size difference.
function isTodayField(field: TemplateField): boolean {
  return /\b(today|day)\b/i.test(field.label);
}

/** A pure energy-totals group (Inverter/Solar Array/Battery/Generator
 *  Energy — "Produced today", "Total lifetime", and the like) as a row of
 *  big KPI numbers, not one more flat list — this is the dataviz "stat
 *  tile" form: a handful of headline figures with nothing to compare them
 *  against *within* the group, so a bar or line would just be decoration
 *  around a number that already reads fine on its own. */
export function EnergyStatCard({
  title,
  fields,
  getValue,
}: {
  title: string;
  fields: TemplateField[];
  getValue: (key: string) => FieldValue;
}) {
  if (fields.length === 0) return null;
  const ordered = [...fields].sort((a, b) => Number(isTodayField(b)) - Number(isTodayField(a)));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className={`grid grid-cols-2 gap-4 ${ordered.length >= 3 ? "sm:grid-cols-4" : "sm:grid-cols-2"}`}>
        {ordered.map((field) => (
          <div key={field.key} className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3.5">
            <p className="text-xs text-muted-foreground">{field.label}</p>
            <p className="mt-1 text-2xl leading-none font-bold tabular-nums text-foreground">{formatFieldValue(getValue(field.key), field)}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
