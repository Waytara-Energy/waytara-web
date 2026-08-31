import { createClient } from "@waytara/supabase/server";
import { Input } from "@waytara/ui/input";
import { Button } from "@waytara/ui/button";
import { createDeviceType, updateDeviceType, addInstrument, removeInstrument } from "./actions";

// Admin-only route (enforced in middleware.ts). Task 8.4's seed migration
// flagged this exact gap: staff/customer could read device_types and
// device_type_instruments but nothing could ever write them — this is
// that editor.
export default async function DevicesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;
  const supabase = await createClient();

  const { data: deviceTypes } = await supabase
    .from("device_types")
    .select("id, code, name, manufacturer, description, device_type_instruments(id, instrument_key, instrument_name, unit, category, is_required)")
    .order("name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Device Catalog</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Device types and the instruments each one reports — what employees pick from during
          Site &amp; Device Setup, and what customers see readings for.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-border bg-primary/10 p-4 text-sm text-primary">Saved.</div>
      )}

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold">Add a device type</h2>
        <form action={createDeviceType} className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Code</label>
            <Input name="code" placeholder="e.g. ev_charger" className="h-9 w-40" required />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <Input name="name" placeholder="e.g. EV Charger" className="h-9 w-48" required />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Manufacturer</label>
            <Input name="manufacturer" placeholder="optional" className="h-9 w-40" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <Input name="description" placeholder="optional" className="h-9 w-56" />
          </div>
          <Button type="submit" size="sm">
            Add
          </Button>
        </form>
      </div>

      <div className="space-y-4">
        {(deviceTypes ?? []).map((dt) => (
          <div key={dt.id} className="rounded-lg border border-border bg-card p-5 space-y-4">
            <form action={updateDeviceType.bind(null, dt.id)} className="flex flex-wrap items-end gap-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Name ({dt.code})</label>
                <Input name="name" defaultValue={dt.name} className="h-9 w-48" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Manufacturer</label>
                <Input name="manufacturer" defaultValue={dt.manufacturer ?? ""} className="h-9 w-40" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <Input name="description" defaultValue={dt.description ?? ""} className="h-9 w-64" />
              </div>
              <Button type="submit" variant="outline" size="sm">
                Save
              </Button>
            </form>

            <div className="space-y-2 border-t border-border pt-4">
              <h3 className="text-xs font-medium text-muted-foreground">
                Instruments ({dt.device_type_instruments.length})
              </h3>
              {dt.device_type_instruments.length > 0 && (
                <ul className="space-y-1.5">
                  {dt.device_type_instruments.map((instrument) => (
                    <li key={instrument.id} className="flex items-center justify-between text-sm">
                      <span>
                        <span className="font-medium">{instrument.instrument_name}</span>{" "}
                        <span className="text-muted-foreground">
                          ({instrument.instrument_key}
                          {instrument.unit ? `, ${instrument.unit}` : ""}
                          {instrument.category ? `, ${instrument.category}` : ""}
                          {instrument.is_required ? ", required" : ""})
                        </span>
                      </span>
                      <form action={removeInstrument.bind(null, instrument.id)}>
                        <Button type="submit" variant="ghost" size="sm">
                          Remove
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}

              <form action={addInstrument.bind(null, dt.id)} className="flex flex-wrap items-end gap-2 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Key</label>
                  <Input name="instrumentKey" placeholder="e.g. battery_soc_pct" className="h-8 w-44 text-xs" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Name</label>
                  <Input name="instrumentName" placeholder="e.g. State of Charge" className="h-8 w-44 text-xs" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Unit</label>
                  <Input name="unit" placeholder="%, V, kWh…" className="h-8 w-24 text-xs" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Category</label>
                  <Input name="category" placeholder="solar, battery…" className="h-8 w-28 text-xs" />
                </div>
                <label className="flex h-8 items-center gap-1.5 text-xs">
                  <input type="checkbox" name="isRequired" className="h-3.5 w-3.5" />
                  Required
                </label>
                <Button type="submit" variant="outline" size="sm">
                  Add Instrument
                </Button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
