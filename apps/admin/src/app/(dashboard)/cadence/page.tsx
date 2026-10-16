import { createClient } from "@waytara/supabase/server";
import { CadenceDownload, type DeviceOption } from "./cadence-download";

// Open to admins and to employees: the list below is whatever the database lets the signed-in person see (an admin sees every
// device, an employee only those on sites they are assigned to), and the readings service checks the same thing again for every
// request, so a device that is not theirs cannot be read even by asking for it directly.
export default async function CadencePage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("equipment")
    .select("id, label, parent_id, retired_at, site:sites(name), device_type:equipment_inventory(category, name, model_number)")
    .is("parent_id", null)
    .is("retired_at", null)
    .order("created_at", { ascending: false })
    .limit(500);

  const devices: DeviceOption[] = (data ?? [])
    .filter((d) => d.device_type?.category === "solar_inverter")
    .map((d) => ({
      id: d.id,
      site: d.site?.name ?? "Unnamed site",
      name: d.label?.trim() || d.device_type?.name || "Inverter",
      model: d.device_type?.model_number ?? null,
    }))
    .sort((a, b) => a.site.localeCompare(b.site) || a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cadence data</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The readings exactly as a unit took them (every 5, 10 or 30 seconds), for the last 4 weeks. Pick a device, the readings and the days, look at the first rows, and download the file.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">Couldn&apos;t load the devices: {error.message}</div>
      ) : devices.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No devices to show. Admins see every device; employees see the devices on the sites they are assigned to.
        </div>
      ) : (
        <CadenceDownload devices={devices} />
      )}
    </div>
  );
}
