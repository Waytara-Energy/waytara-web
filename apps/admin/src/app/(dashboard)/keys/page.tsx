import { createClient } from "@waytara/supabase/server";
import { KeysManager, type KeyDevice } from "./keys-manager";

// Open to admins and to employees: the list is whatever the database lets the signed-in person see (an admin sees every device, an
// employee those on the sites they are assigned to), and the backend checks the same thing again before it creates, rotates or
// revokes anything. The secret itself is never in the database in the clear and never on this page: it is shown once, when it is made.
export default async function KeysPage() {
  const supabase = await createClient();
  const [{ data: equipment, error }, { data: keyRows }] = await Promise.all([
    supabase
      .from("equipment")
      .select("id, label, parent_id, retired_at, site:sites(name), device_type:equipment_inventory(category, name, model_number)")
      .is("parent_id", null)
      .is("retired_at", null)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("equipment_keys")
      .select("id, equipment_id, kind, label, key_fingerprint, created_at, last_used_at, expires_at")
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  const keysByDevice = new Map<string, KeyDevice["keys"]>();
  for (const k of keyRows ?? []) {
    const list = keysByDevice.get(k.equipment_id) ?? [];
    list.push({ id: k.id, kind: k.kind as "gateway" | "charger", label: k.label, fingerprint: k.key_fingerprint, createdAt: k.created_at, lastUsedAt: k.last_used_at, expiresAt: k.expires_at });
    keysByDevice.set(k.equipment_id, list);
  }

  const devices: KeyDevice[] = (equipment ?? [])
    .filter((d) => d.device_type?.category === "solar_inverter" || d.device_type?.category === "ev_charger")
    .map((d) => ({
      id: d.id,
      site: d.site?.name ?? "Unnamed site",
      name: d.label?.trim() || d.device_type?.name || "Device",
      model: d.device_type?.model_number ?? null,
      isCharger: d.device_type?.category === "ev_charger",
      keys: keysByDevice.get(d.id) ?? [],
    }))
    .sort((a, b) => a.site.localeCompare(b.site) || a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Device keys</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The secret each monitoring unit or EV charger uses to talk to WayTara. A unit normally gets its key during setup; use this page to make or replace
          one by hand, or to cut a lost one off. A new secret is shown once, so copy it before closing the box.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">Couldn&apos;t load the devices: {error.message}</div>
      ) : devices.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No devices to show. Admins see every device; employees see the devices on the sites they are assigned to.
        </div>
      ) : (
        <KeysManager devices={devices} />
      )}
    </div>
  );
}
