// Pure helpers for the EV charger's "OCPP and charger" settings on the Devices page: which charger settings (OCPP configuration keys) can be read
// and changed, checking a value before it is sent, the words for the charger's answer, the address a charger is pointed at, and a readable line for
// each message of the OCPP log.

export type ConfigKind = "seconds" | "flag" | "list";

export interface ConfigKeyMeta {
  key: string;
  label: string;
  help: string;
  kind: ConfigKind;
  unit?: string;
  min?: number;
  max?: number;
}

/** The settings staff may read and change (the service accepts exactly these keys). */
export const CONFIG_KEYS: ConfigKeyMeta[] = [
  { key: "HeartbeatInterval", label: "Heartbeat interval", help: "How often the charger says it is alive.", kind: "seconds", unit: "s", min: 5, max: 3600 },
  { key: "MeterValueSampleInterval", label: "Meter reading interval", help: "How often the charger sends power and energy while charging.", kind: "seconds", unit: "s", min: 5, max: 3600 },
  { key: "ClockAlignedDataInterval", label: "Clock-aligned readings", help: "Readings on the clock (every 15 minutes, say). 0 turns them off.", kind: "seconds", unit: "s", min: 0, max: 86400 },
  { key: "ConnectionTimeOut", label: "Plug-in timeout", help: "How long the charger waits for a plug after it is started or tapped.", kind: "seconds", unit: "s", min: 1, max: 600 },
  { key: "MeterValuesSampledData", label: "Readings sent", help: "What each reading holds, separated by commas, for example Energy.Active.Import.Register,Power.Active.Import.", kind: "list" },
  { key: "StopTransactionOnEVSideDisconnect", label: "Stop when the car unplugs", help: "End the charge when the cable is taken out of the car.", kind: "flag" },
];

export const CONFIG_KEY_NAMES: string[] = CONFIG_KEYS.map((k) => k.key);

export const metaOf = (key: string): ConfigKeyMeta | undefined => CONFIG_KEYS.find((k) => k.key === key);

const MEASURAND = /^[A-Za-z]+(\.[A-Za-z]+)*$/;

/** A value as it will be sent, or why it cannot be. */
export function validateConfigValue(key: string, raw: string): { ok: true; value: string } | { ok: false; message: string } {
  const meta = metaOf(key);
  if (!meta) return { ok: false, message: "This setting cannot be changed here." };
  const text = raw.trim();
  if (meta.kind === "seconds") {
    if (!/^\d{1,6}$/.test(text)) return { ok: false, message: `Type a whole number of seconds (${meta.min} to ${meta.max}).` };
    const n = Number(text);
    if (n < (meta.min ?? 0) || n > (meta.max ?? Number.MAX_SAFE_INTEGER)) return { ok: false, message: `The value must be between ${meta.min} and ${meta.max} seconds.` };
    return { ok: true, value: String(n) };
  }
  if (meta.kind === "flag") {
    const t = text.toLowerCase();
    if (["true", "on", "yes", "1"].includes(t)) return { ok: true, value: "true" };
    if (["false", "off", "no", "0"].includes(t)) return { ok: true, value: "false" };
    return { ok: false, message: "Choose on or off." };
  }
  const parts = text.split(",").map((p) => p.trim());
  if (text === "" || parts.some((p) => !MEASURAND.test(p))) return { ok: false, message: "List the readings separated by commas, for example Energy.Active.Import.Register,Power.Active.Import." };
  if (text.length > 200) return { ok: false, message: "That list is too long." };
  return { ok: true, value: parts.join(",") };
}

/** The charger's answer to a change, in words. */
export function configStatusText(status: string): { ok: boolean; text: string } {
  switch (status) {
    case "Accepted":
      return { ok: true, text: "Saved on the charger." };
    case "RebootRequired":
      return { ok: true, text: "Saved. The charger uses it after it restarts (use Reset)." };
    case "Rejected":
      return { ok: false, text: "The charger refused this value." };
    case "NotSupported":
      return { ok: false, text: "This charger does not have this setting." };
    default:
      return { ok: false, text: `The charger answered ${status}.` };
  }
}

/** A setting's value as shown: seconds with their unit, a flag as On / Off, a list as it is. */
export function shownValue(meta: ConfigKeyMeta, value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  if (meta.kind === "seconds") return `${value} ${meta.unit ?? "s"}`;
  if (meta.kind === "flag") return value.toLowerCase() === "true" ? "On" : "Off";
  return value;
}

/** The address a charger is pointed at while it is on its monitoring unit's own Wi-Fi network. */
export function wsAddress(chargePointId: string, ip = "192.168.4.1", port = 8080): string {
  return `ws://${ip}:${port}/ocpp/${chargePointId}`;
}

export interface FrameRow {
  at: string;
  /** "in" = from the charger, "out" = from WayTara */
  direction: "in" | "out";
  /** the OCPP action for a call, "Answer" for a result, "Error" for a refusal */
  action: string;
  summary: string;
  kind: "call" | "answer" | "error" | "other";
}

const cut = (text: string, n = 90) => (text.length > n ? `${text.slice(0, n - 1)}…` : text);

function brief(action: string, p: Record<string, unknown>): string {
  const s = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : "");
  switch (action) {
    case "BootNotification":
      return [s(p.chargePointVendor), s(p.chargePointModel), p.firmwareVersion ? `fw ${s(p.firmwareVersion)}` : ""].filter(Boolean).join(" ");
    case "StatusNotification":
      return `connector ${s(p.connectorId)}: ${s(p.status)}${p.errorCode && p.errorCode !== "NoError" ? ` (${s(p.errorCode)})` : ""}`;
    case "StartTransaction":
      return `meter ${s(p.meterStart)} Wh`;
    case "StopTransaction":
      return `meter ${s(p.meterStop)} Wh${p.reason ? `, ${s(p.reason)}` : ""}`;
    case "MeterValues": {
      const sampled = (((p.meterValue as { sampledValue?: { measurand?: string; value?: string; unit?: string }[] }[] | undefined)?.[0]?.sampledValue) ?? []).slice(0, 4);
      return sampled.map((v) => `${(v.measurand ?? "Energy").replace(/\.Active\.Import(\.Register)?/, "").replace(".Import", "")} ${v.value ?? ""}${v.unit ? ` ${v.unit}` : ""}`).join(", ");
    }
    case "Heartbeat":
      return "";
    default:
      return cut(JSON.stringify(p));
  }
}

/** One OCPP message (the service keeps them as text) as a row for the log. A message that is not OCPP shows as it is. */
export function formatFrame(f: { at: string; direction: "in" | "out"; frame: string }): FrameRow {
  const base = { at: f.at, direction: f.direction };
  let parsed: unknown;
  try {
    parsed = JSON.parse(f.frame);
  } catch {
    return { ...base, action: "Message", summary: cut(f.frame), kind: "other" };
  }
  if (!Array.isArray(parsed)) return { ...base, action: "Message", summary: cut(f.frame), kind: "other" };
  const [type, , a, b] = parsed as [number, string, unknown, unknown];
  if (type === 2 && typeof a === "string") return { ...base, action: a, summary: brief(a, (b ?? {}) as Record<string, unknown>), kind: "call" };
  if (type === 3) {
    const payload = (a ?? {}) as Record<string, unknown>;
    const status = typeof payload.status === "string" ? payload.status : "";
    return { ...base, action: "Answer", summary: status || cut(JSON.stringify(payload)), kind: "answer" };
  }
  if (type === 4) return { ...base, action: "Error", summary: [a, b].filter((x) => typeof x === "string" && x).join(": "), kind: "error" };
  return { ...base, action: "Message", summary: cut(f.frame), kind: "other" };
}

/** WayTara staff (the people who may change a charger's own settings and read its message log): the same three roles the service treats as staff. */
export const isStaffRole = (role: string | null | undefined): boolean => role === "admin" || role === "employee" || role === "site_engineer";

/** The UTC day (YYYY-MM-DD) the message log files are named by. */
export const utcDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** Is this a day the log download accepts? */
export const isLogDay = (day: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(`${day}T00:00:00Z`));
