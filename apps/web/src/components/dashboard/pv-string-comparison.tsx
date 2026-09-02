import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PV_STRING_FIELDS, formatValue } from "@/lib/telemetry-catalog";

/** PV1 vs PV2 side by side — useful for spotting one string
 *  underperforming (shading, dirty panel, a fault on just that string).
 *  Snapshot on page load, not live-polled — the two live charts on this
 *  page cover the "is something changing right now" need. */
export function PvStringComparison({ getValue }: { getValue: (key: string) => number | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">PV String Comparison</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        {(["pv1", "pv2"] as const).map((string) => (
          <div key={string} className="space-y-1.5 rounded-lg border border-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              String {string === "pv1" ? "1" : "2"}
            </p>
            {PV_STRING_FIELDS[string].map((field) => (
              <div key={field.key} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{field.label}</span>
                <span className="font-medium text-foreground">{formatValue(getValue(field.key), field)}</span>
              </div>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
