import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatValue, type TelemetryField } from "@/lib/telemetry-catalog";

/** A generic "detail" card — a flat list of label/value rows under one
 *  title, styled after PvStringComparison's row markup. Phase 3's read-side
 *  coverage pass mounts this 4× on Monitoring (Battery/Inverter/Grid/Load
 *  detail) instead of 4 bespoke components, since the shape is identical:
 *  just a different field list per flow node. */
export function MetricListCard({
  title,
  fields,
  getValue,
}: {
  title: string;
  fields: TelemetryField[];
  getValue: (key: string) => number | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {fields.map((field) => (
          <div key={field.key} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{field.label}</span>
            <span className="font-medium text-foreground">{formatValue(getValue(field.key), field)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
