import { Card, CardContent } from "@/components/ui/card";
import type { DeviceParameterReading } from "@/lib/device-catalog-data";

function formatParameterValue(value: number | null, unit: string | null): string {
  if (value === null) return "—";
  const rounded = Number.isInteger(value) ? value.toLocaleString("en-IN") : value.toFixed(2);
  return unit ? `${rounded} ${unit}` : rounded;
}

/** Generic telemetry cards for a device — driven entirely by its own
 *  device_parameters catalog + latest device_readings (see
 *  fetchDeviceParameterReadings), not any hardcoded key list, so it's
 *  correct for any device category rather than only the solar inverter's
 *  own OVERVIEW_KEYS-shaped view. */
export function DeviceParameterCards({ parameters }: { parameters: DeviceParameterReading[] }) {
  if (parameters.length === 0) {
    return <p className="text-sm text-muted-foreground">No telemetry parameters defined for this device yet.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {parameters.map((p) => (
        <Card key={p.key}>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{p.name}</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{formatParameterValue(p.value, p.unit)}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
