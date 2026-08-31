import { getCurrentProfile } from "@waytara/supabase/auth";
import { createClient } from "@waytara/supabase/server";

export default async function SitesPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: customer } = profile
    ? await supabase.from("customers").select("plan:plans(max_devices)").eq("id", profile.id).maybeSingle()
    : { data: null };

  const maxDevices = customer?.plan?.max_devices ?? null;

  const { data: sites } = await supabase
    .from("sites")
    .select("id, name, property_type, power_source_category")
    .order("created_at", { ascending: false });

  const { data: devices } = await supabase
    .from("devices")
    .select("id, site_id, device_uid, label, status, device_type:device_types(name)")
    .order("created_at", { ascending: false });

  const totalDevices = devices?.length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-theme-primary">Sites &amp; Devices</h1>
        <p className="mt-1 text-sm text-theme-muted">
          {totalDevices} device{totalDevices === 1 ? "" : "s"}
          {maxDevices !== null ? ` of ${maxDevices} included on your plan` : ""}
        </p>
      </div>

      {!sites || sites.length === 0 ? (
        <div className="rounded-xl border border-theme-border bg-theme-surface p-6 text-sm text-theme-muted">
          No sites set up yet — your WayTara advisor sets this up during installation.
        </div>
      ) : (
        sites.map((site) => (
          <div key={site.id} className="rounded-xl border border-theme-border bg-theme-surface p-5">
            <h2 className="font-semibold text-theme-primary">{site.name}</h2>
            <p className="text-xs text-theme-muted capitalize">
              {site.property_type.replace(/_/g, " ")} · {site.power_source_category.replace(/_/g, " ")}
            </p>

            <div className="mt-4 space-y-2">
              {devices
                ?.filter((d) => d.site_id === site.id)
                .map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between rounded-lg border border-theme-border bg-theme-bg px-3 py-2 text-sm"
                  >
                    <span>
                      <span className="font-medium text-theme-primary">
                        {d.device_type?.name ?? "Device"}
                      </span>{" "}
                      <span className="text-theme-muted">— {d.label || d.device_uid}</span>
                    </span>
                    <span className="rounded-full bg-theme-highlight-subtle px-2 py-0.5 text-xs font-medium capitalize text-theme-highlight">
                      {d.status}
                    </span>
                  </div>
                )) ?? null}
              {devices?.filter((d) => d.site_id === site.id).length === 0 && (
                <p className="text-sm text-theme-muted">No devices at this site yet.</p>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
