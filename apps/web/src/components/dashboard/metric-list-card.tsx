import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFieldValue, type TemplateField, type FieldValue } from "@/lib/template-field-format";
import { lookupEnumLabel, type EnumOption } from "@/lib/enum-labels";

/** A generic "detail" card — a flat list of label/value rows under one
 *  title, styled after PvStringComparison's row markup. Field-list-source-
 *  agnostic: fed a DB-driven `TemplateField[]` (see template-fields.ts) now
 *  instead of a hardcoded telemetry-catalog.ts array, but the component
 *  itself needed no structural change for that — it always just took a
 *  field list + a value lookup. `enumOptionsByRef` is optional since most
 *  callers have no enum-valued fields in their list at all. */
export function MetricListCard({
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
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {fields.map((field) => {
          const raw = getValue(field.key);
          const display =
            field.valueKind === "enum" && field.enumRef && enumOptionsByRef
              ? (lookupEnumLabel(enumOptionsByRef, field.enumRef, raw as string | number | null) ?? raw)
              : raw;
          return (
            <div key={field.key} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{field.label}</span>
              <span className="font-medium text-foreground">{formatFieldValue(display, field)}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
