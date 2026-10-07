import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { ALERT_PREFIX, FAULT_ALARM_KEYS, needsReminder, offlineMessage, offlineStatus, raisedAlerts, reminderDue, type AlertKind, type HeartbeatRow } from "@/lib/device-alerts";
import { sendDeviceAlertEmail } from "@/lib/send-device-alert-email";

// Device alerts, every 5 minutes (pg_cron calls this route; see migrations 20261003000000_security_hardening.sql and
// 20261007030000_alert_reminders.sql).
// No signed-in user exists for a scheduled job, so this is one of the legitimate service_role cases (see
// service-role.ts's own doc comment).
//
// For each active device it decides three things, opens or closes the matching alert, and e-mails the customer when
// something starts or clears:
//   - offline: the agent says the device does not answer (or the agent itself has gone quiet) - see device-alerts.ts.
//     Devices that have never had an agent heartbeat are judged slowly (6 hours) and are not e-mailed.
//   - fault:   a non-zero fault_message_N register, decoded with the Deye fault table.
//   - alarm:   a non-zero alarm_status_N register.
// An alert is only opened if there is not already an open one (resolved_at is null) of the same kind for the device,
// which is also what stops the same e-mail going out every run: the e-mail is sent when the alert is opened, and again
// (briefly) when it clears. A critical alert (offline, a serious fault) that the customer has not acknowledged is
// e-mailed again every 3 hours until they acknowledge it or it clears; acknowledging does not close it, so it is not
// raised a second time while it is still true.

type Device = {
  id: string;
  label: string | null;
  device_type: { serial_number: string | null; model_number: string | null } | null;
  site: { name: string | null; customer_id: string | null } | null;
};

interface OpenAlert {
  id: string;
  device_id: string;
  severity: string;
  message: string;
  ts: string;
  acknowledged_at: string | null;
  last_notified_at: string | null;
  notified_count: number;
}

interface Pending {
  deviceId: string;
  kind: AlertKind;
  severity: "critical" | "warning";
  message: string;
}

const KINDS: AlertKind[] = ["offline", "fault", "alarm"];

function kindOfMessage(message: string): AlertKind | null {
  return KINDS.find((k) => message.startsWith(ALERT_PREFIX[k])) ?? null;
}

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req, "detect-alerts")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const now = Date.now();

  const { data: deviceRows, error: devicesError } = await supabase
    .from("equipment")
    .select("id, label, device_type:equipment_inventory(serial_number, model_number), site:sites(name, customer_id)")
    .eq("device_status", "active");
  if (devicesError) return NextResponse.json({ error: devicesError.message }, { status: 500 });

  const devices = (deviceRows ?? []) as unknown as Device[];
  const deviceIds = devices.map((d) => d.id);
  if (deviceIds.length === 0) return NextResponse.json({ checked: 0, newAlerts: 0, resolvedAlerts: 0, emails: 0 });

  // One row per device (computed in the database - never page equipment_latest here: the REST API caps a response at
  // 1,000 rows, see migration 20261005000000_device_last_seen.sql). Errors stop the job: guessing "nobody reported"
  // would raise a critical alert for every device.
  const [lastSeen, heartbeats, faultRows, openAlerts] = await Promise.all([
    supabase.rpc("device_last_seen", { p_equipment_ids: deviceIds }),
    supabase.from("equipment_heartbeat").select("equipment_id, last_seen, upload_interval_s, device_online, last_read_at, device_error").in("equipment_id", deviceIds),
    supabase.from("equipment_latest").select("equipment_id, key_name, value").in("equipment_id", deviceIds).in("key_name", FAULT_ALARM_KEYS),
    supabase
      .from("alerts")
      .select("id, device_id, severity, message, ts, acknowledged_at, last_notified_at, notified_count")
      .in("device_id", deviceIds)
      .is("resolved_at", null),
  ]);
  for (const r of [lastSeen, heartbeats, faultRows, openAlerts]) {
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
  }

  const latestTs = new Map<string, string>((lastSeen.data ?? []).map((r) => [r.equipment_id, r.last_ts]));
  const beatBy = new Map<string, HeartbeatRow>((heartbeats.data ?? []).map((h) => [h.equipment_id, h]));
  const faultValues = new Map<string, Record<string, number | null>>();
  for (const r of faultRows.data ?? []) {
    const m = faultValues.get(r.equipment_id) ?? {};
    m[r.key_name] = r.value;
    faultValues.set(r.equipment_id, m);
  }
  const openBy = new Map<string, OpenAlert>(); // `${deviceId}:${kind}`
  for (const a of (openAlerts.data ?? []) as OpenAlert[]) {
    const kind = kindOfMessage(a.message);
    if (kind) openBy.set(`${a.device_id}:${kind}`, a);
  }

  const toOpen: Pending[] = [];
  const toClose: { id: string; deviceId: string; kind: AlertKind; emailed: boolean }[] = [];
  const toRemind: { alert: OpenAlert; kind: AlertKind; message: string }[] = [];
  const monitored = new Set<string>();

  for (const device of devices) {
    const label = device.label || device.device_type?.serial_number || device.device_type?.model_number || "Device";
    const offline = offlineStatus(beatBy.get(device.id) ?? null, latestTs.get(device.id) ?? null, now);
    if (offline.monitored) monitored.add(device.id);

    const open = (kind: AlertKind) => openBy.get(`${device.id}:${kind}`);
    const want = new Map<AlertKind, Pending>();
    if (offline.offline) want.set("offline", { deviceId: device.id, kind: "offline", severity: "critical", message: offlineMessage(label, offline) });
    // Fault and alarm registers of a device that is not answering are old news: leave those alerts as they are.
    if (!offline.offline) {
      for (const a of raisedAlerts(label, faultValues.get(device.id) ?? {})) {
        want.set(a.kind, { deviceId: device.id, kind: a.kind, severity: a.severity, message: a.message });
      }
    }

    for (const kind of KINDS) {
      const existing = open(kind);
      const wanted = want.get(kind);
      if (wanted && !existing) toOpen.push(wanted);
      else if (!wanted && existing && !(kind !== "offline" && offline.offline)) toClose.push({ id: existing.id, deviceId: device.id, kind, emailed: existing.notified_count > 0 });
      else if (wanted && existing && offline.monitored && !existing.acknowledged_at && needsReminder(existing.severity) && reminderDue(existing.last_notified_at, now)) {
        toRemind.push({ alert: existing, kind, message: wanted.message });
      }
    }
  }

  const closedAt = new Date().toISOString();
  const [insertResult, resolveResult] = await Promise.all([
    toOpen.length > 0
      ? supabase.from("alerts").insert(toOpen.map((p) => ({ device_id: p.deviceId, severity: p.severity, message: p.message }))).select("id, device_id, message")
      : Promise.resolve({ data: [] as { id: string; device_id: string; message: string }[], error: null }),
    toClose.length > 0
      ? supabase.from("alerts").update({ resolved_at: closedAt }).in("id", toClose.map((c) => c.id))
      : Promise.resolve({ error: null }),
  ]);
  if (insertResult.error) console.error("[detect-alerts] inserting alerts failed:", insertResult.error.message);
  if (resolveResult.error) console.error("[detect-alerts] resolving alerts failed:", resolveResult.error.message);
  const opened = insertResult.error ? [] : toOpen;
  const closed = resolveResult.error ? [] : toClose;
  // A cleared alert also drops off the customer's unread list (as it always did), unless they had acknowledged it.
  if (closed.length > 0) {
    const { error } = await supabase.from("alerts").update({ acknowledged_at: closedAt }).in("id", closed.map((c) => c.id)).is("acknowledged_at", null);
    if (error) console.error("[detect-alerts] marking cleared alerts as read failed:", error.message);
  }
  const insertedId = new Map<string, string>(); // `${deviceId}:${kind}` -> the new alert's id
  for (const r of insertResult.data ?? []) {
    const kind = kindOfMessage(r.message);
    if (kind) insertedId.set(`${r.device_id}:${kind}`, r.id);
  }

  // ---- e-mail the customers (only for devices whose agent reports, and only to people who left alert e-mails on)
  const deviceById = new Map(devices.map((d) => [d.id, d]));
  const customerIds = [...new Set([...opened.map((o) => o.deviceId), ...closed.map((c) => c.deviceId), ...toRemind.map((r) => r.alert.device_id)].map((id) => deviceById.get(id)?.site?.customer_id).filter((id): id is string => !!id))];
  const profiles = new Map<string, { email: string; full_name: string | null }>();
  if (customerIds.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name, notification_preferences, deactivated_at, deleted_at")
      .in("id", customerIds);
    for (const p of data ?? []) {
      const prefs = (p.notification_preferences as { email_alerts?: boolean } | null) ?? {};
      if (p.deactivated_at || p.deleted_at || prefs.email_alerts === false || !p.email) continue;
      profiles.set(p.id, { email: p.email, full_name: p.full_name });
    }
  }

  let emails = 0;
  const notify = async (deviceId: string, kind: AlertKind, event: "opened" | "reminder" | "resolved", message: string, extra?: { since?: number; sentBefore?: number }) => {
    if (!monitored.has(deviceId)) return false;
    const device = deviceById.get(deviceId);
    const profile = device?.site?.customer_id ? profiles.get(device.site.customer_id) : undefined;
    if (!device || !profile) return false;
    const deviceLabel = device.label || device.device_type?.serial_number || device.device_type?.model_number || "Your device";
    const sent = await sendDeviceAlertEmail(profile.email, { kind, event, customerName: profile.full_name, deviceLabel, siteName: device.site?.name ?? null, message, ...extra });
    if (sent) emails += 1;
    return sent;
  };
  // Remember when the customer was last told, so the next reminder is due 3 hours later.
  const markNotified = async (id: string, previousCount: number) => {
    const { error } = await supabase.from("alerts").update({ last_notified_at: new Date().toISOString(), notified_count: previousCount + 1 }).eq("id", id);
    if (error) console.error("[detect-alerts] recording the e-mail failed:", error.message);
  };
  await Promise.all([
    ...opened.map(async (o) => {
      const id = insertedId.get(`${o.deviceId}:${o.kind}`);
      if ((await notify(o.deviceId, o.kind, "opened", o.message)) && id) await markNotified(id, 0);
    }),
    ...toRemind.map(async (r) => {
      const sent = await notify(r.alert.device_id, r.kind, "reminder", r.message, { since: new Date(r.alert.ts).getTime(), sentBefore: r.alert.notified_count });
      if (sent) await markNotified(r.alert.id, r.alert.notified_count);
    }),
    ...closed.filter((c) => c.emailed).map((c) => notify(c.deviceId, c.kind, "resolved", "")),
  ]);

  return NextResponse.json({ checked: devices.length, newAlerts: opened.length, resolvedAlerts: closed.length, reminders: toRemind.length, emails });
}
