import { createClient } from "@waytara/supabase/server";
import { DeviceCard } from "./device-card";

const WHEN = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Who did what to this device and when (task T23): key changes, Wi-Fi edits, restarts, going offline and back. The view already leaves out the
 *  technical detail for a customer; the rows are the ones the customer's access to the site allows. The newest ten. */
export async function DeviceActivity({ deviceId }: { deviceId: string }) {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("device_activity_log")
    .select("id, at, actor_name, actor_role, summary")
    .eq("equipment_id", deviceId)
    .order("at", { ascending: false })
    .limit(10);

  return (
    <DeviceCard title="Recent activity" description="What was done to this device, and when.">
      {!rows || rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing has been recorded yet.</p>
      ) : (
        <ul className="divide-y divide-theme-border">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 text-sm first:pt-0 last:pb-0">
              <span>
                {r.summary}
                {r.actor_name ? <span className="text-muted-foreground"> · {r.actor_name}</span> : null}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{r.at ? WHEN.format(new Date(r.at)) : ""}</span>
            </li>
          ))}
        </ul>
      )}
    </DeviceCard>
  );
}
