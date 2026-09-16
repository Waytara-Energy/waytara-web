import { Card, CardContent } from "@/components/ui/card";
import { TODAY_ENERGY_FIELDS, formatValue } from "@/lib/telemetry-catalog";

/** Shared by the site Overview page and a device's own detail page —
 *  both render this exact "today's totals" tile grid for whichever
 *  device is currently in view. */
export function TodaySoFar({ get }: { get: (key: string) => number | null }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-foreground">Today so far</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {TODAY_ENERGY_FIELDS.map((field) => (
          <Card key={field.key}>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{field.label}</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{formatValue(get(field.key), field)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
