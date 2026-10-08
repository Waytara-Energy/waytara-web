// What the notification panel lists and how its filter chips narrow it: the faults the inverters are reporting right now, and the
// alerts raised for them. Pure functions, so the rules are tested.

import { FAULT_BITMASK_KEYS_LIVE } from "./overview-keys";
import { getFaultInfo, type FaultInfo } from "./deye-fault-codes";

export type NotificationFilter = "all" | "faults" | "alerts" | "unread" | "critical" | "warning";

export const NOTIFICATION_FILTERS: { value: NotificationFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "faults", label: "Faults" },
  { value: "alerts", label: "Alerts" },
  { value: "unread", label: "Unread" },
  { value: "critical", label: "Critical" },
  { value: "warning", label: "Warning" },
];

export interface AlertLike {
  id: string;
  device_id: string;
  severity: string;
  message: string;
  ts: string;
  acknowledged_at: string | null;
}

export interface FaultItem {
  deviceId: string;
  code: number;
  info: FaultInfo;
}

/** The fault a set of the inverter's fault/alarm registers reports: the first non-zero one (null when all are clear). */
export function faultCodeOf(values: Record<string, number | null | undefined>): number | null {
  for (const key of FAULT_BITMASK_KEYS_LIVE) {
    const v = values[key];
    if (typeof v === "number" && v !== 0) return v;
  }
  return null;
}

/** The active faults as list items, worst first (critical before warning). */
export function faultItems(codes: Record<string, number | null>): FaultItem[] {
  const items: FaultItem[] = [];
  for (const [deviceId, code] of Object.entries(codes)) {
    const info = code ? getFaultInfo(code) : null;
    if (code && info) items.push({ deviceId, code, info });
  }
  return items.sort((a, b) => Number(b.info.severity === "critical") - Number(a.info.severity === "critical"));
}

/** An alert's headline and its body: the words before the first colon when that is a short heading ("Device offline"), else the
 *  severity ("Critical") with the whole message as the body. */
export function alertTitleAndBody(message: string, severity: string): { title: string; body: string } {
  const i = message.indexOf(":");
  if (i > 0 && i <= 40) return { title: message.slice(0, i).trim(), body: message.slice(i + 1).trim() };
  return { title: severity ? severity.charAt(0).toUpperCase() + severity.slice(1) : "Alert", body: message.trim() };
}

/** What a chip leaves in the list. "Unread" is every active fault (a fault stays unread while it is active) and the alerts not yet
 *  marked as read; "Critical" and "Warning" apply to faults and alerts alike. */
export function applyFilter(faults: FaultItem[], alerts: AlertLike[], filter: NotificationFilter): { faults: FaultItem[]; alerts: AlertLike[] } {
  switch (filter) {
    case "faults":
      return { faults, alerts: [] };
    case "alerts":
      return { faults: [], alerts };
    case "unread":
      return { faults, alerts: alerts.filter((a) => !a.acknowledged_at) };
    case "critical":
      return { faults: faults.filter((f) => f.info.severity === "critical"), alerts: alerts.filter((a) => a.severity === "critical") };
    case "warning":
      return { faults: faults.filter((f) => f.info.severity === "warning"), alerts: alerts.filter((a) => a.severity === "warning") };
    default:
      return { faults, alerts };
  }
}

/** How many items each chip would show (for the number beside its name). */
export function filterCounts(faults: FaultItem[], alerts: AlertLike[]): Record<NotificationFilter, number> {
  const count = (f: NotificationFilter) => {
    const r = applyFilter(faults, alerts, f);
    return r.faults.length + r.alerts.length;
  };
  return { all: count("all"), faults: count("faults"), alerts: count("alerts"), unread: count("unread"), critical: count("critical"), warning: count("warning") };
}

/** The number on the bell: active faults plus alerts not yet read. */
export function unreadTotal(faults: FaultItem[], alerts: AlertLike[]): number {
  return faults.length + alerts.filter((a) => !a.acknowledged_at).length;
}
