// How a device setting is read and written, and how sure the page is of it. Pure, so it is tested.
//
// A setting's history is the append-only `equipment_configs` log. Rows come from three places:
//   - "agent_initial_read" / "agent_readback": the agent read the register from the inverter (what the device really has);
//   - "customer_dashboard" (or the admin app): somebody asked for a change.
// The page shows the device's value when the agent has the last word, and the requested value, marked pending, until the agent
// has read it back from the inverter.

export interface ConfigRow {
  value: string;
  source: string | null;
  /** ISO time. */
  ts: string;
}

export type SettingState =
  /** The inverter itself reported this value (or has confirmed what was asked). */
  | "confirmed"
  /** Asked for, not yet read back from the inverter. */
  | "pending"
  /** Asked for, but the inverter reports something else a moment after. */
  | "mismatch"
  /** Nothing is known: never read from the device, never set. */
  | "unknown";

export interface SettingStatus {
  state: SettingState;
  /** The value to show. */
  value: string | null;
  /** When that value was last written or read. */
  at: string | null;
  /** What the inverter reports, when it differs from what was asked (state "mismatch"). */
  deviceValue: string | null;
}

const isAgent = (source: string | null) => (source ?? "").startsWith("agent");

/** How long after a request the inverter's own reading counts as the answer to it (a later difference is a change made on the device). */
export const ANSWER_WINDOW_MS = 5 * 60_000;

/** Two stored values of the same setting mean the same thing ("1" and "true"; "100" and "0100"). */
export function sameValue(a: string | null | undefined, b: string | null | undefined, valueKind = "text"): boolean {
  if (valueKind === "bool") return parseBool(a) === parseBool(b);
  const na = Number(a);
  const nb = Number(b);
  if (valueKind !== "text" && a !== null && b !== null && a !== undefined && b !== undefined && String(a).trim() !== "" && String(b).trim() !== "" && Number.isFinite(na) && Number.isFinite(nb)) return na === nb;
  return (a ?? "").trim() === (b ?? "").trim();
}

/** The state of one setting from its rows, oldest first. `valueKind` says how to compare what was asked with what the inverter reports. */
export function settingStatus(rows: readonly ConfigRow[], valueKind = "text"): SettingStatus {
  if (rows.length === 0) return { state: "unknown", value: null, at: null, deviceValue: null };
  const lastAgent = [...rows].reverse().find((r) => isAgent(r.source)) ?? null;
  const lastRequest = [...rows].reverse().find((r) => !isAgent(r.source)) ?? null;

  if (lastRequest && (!lastAgent || lastRequest.ts > lastAgent.ts)) return { state: "pending", value: lastRequest.value, at: lastRequest.ts, deviceValue: lastAgent?.value ?? null };
  if (!lastAgent) return { state: "unknown", value: lastRequest?.value ?? null, at: lastRequest?.ts ?? null, deviceValue: null };

  // The agent has the last word. If somebody asked for something just before and the inverter says otherwise, the write did not take.
  if (lastRequest && !sameValue(lastRequest.value, lastAgent.value, valueKind) && Date.parse(lastAgent.ts) - Date.parse(lastRequest.ts) <= ANSWER_WINDOW_MS) {
    return { state: "mismatch", value: lastAgent.value, at: lastAgent.ts, deviceValue: lastAgent.value };
  }
  return { state: "confirmed", value: lastAgent.value, at: lastAgent.ts, deviceValue: lastAgent.value };
}

// ---- values -----------------------------------------------------------------------------------------------------------------

/** An on/off setting as stored: the agent writes 1 and 0, the page used to write true and false. null when it is neither. */
export function parseBool(v: string | null | undefined): boolean | null {
  const t = (v ?? "").trim().toLowerCase();
  if (t === "1" || t === "true" || t === "on") return true;
  if (t === "0" || t === "false" || t === "off") return false;
  return null;
}

/** A time stored as hour-and-minute digits (100 is 01:00, 1730 is 17:30) as "HH:MM"; null when it is not a valid time. */
export function hhmmToTime(v: string | null | undefined): string | null {
  if (v === null || v === undefined || v.trim() === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 2359) return null;
  const h = Math.floor(n / 100);
  const m = n % 100;
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "01:30" as the digits the register holds ("130"); null when it is not a valid time. */
export function timeToHhmm(time: string): string | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time.trim());
  return m ? String(Number(m[1]) * 100 + Number(m[2])) : null;
}

/** What the page sends to be saved, in the form the agent understands: on/off as true or false, a time as its digits. */
export function toStoredValue(valueKind: string, shown: string): string {
  if (valueKind === "bool") return parseBool(shown) ? "true" : "false";
  if (valueKind === "time") return timeToHhmm(shown) ?? shown;
  return shown;
}

/** What the page shows for a stored value: a time as "HH:MM", an on/off as "true" or "false"; anything else as it is. */
export function toShownValue(valueKind: string, stored: string | null): string {
  if (stored === null) return "";
  if (valueKind === "bool") {
    const b = parseBool(stored);
    return b === null ? "" : b ? "true" : "false";
  }
  if (valueKind === "time") return hhmmToTime(stored) ?? "";
  return stored;
}

// ---- grouping ---------------------------------------------------------------------------------------------------------------

/** The pages of an inverter’s own menu (System Setup on its screen) that hold settings a customer may change. */
export type SettingArea = "basic" | "battery" | "work_mode" | "grid" | "advanced" | "gen_port" | "account";

export const AREA_LABEL: Record<SettingArea, string> = {
  basic: "Basic settings",
  battery: "Battery settings",
  work_mode: "Work mode",
  grid: "Grid settings",
  advanced: "Advanced function",
  gen_port: "Gen port use",
  account: "Account",
};
export const AREA_ORDER: SettingArea[] = ["basic", "battery", "work_mode", "grid", "advanced", "gen_port"];

export interface SettingPlace {
  area: SettingArea;
  /** The heading of the block of rows on that page. */
  section: string;
  /** Position of that block on the page (lower first), the order of the inverter’s own screens. */
  order: number;
}

/** Where a solar inverter’s setting lives, following the inverter’s own menu: from the template’s group name (and its key for the few
 *  that share a group). A setting the inverter keeps on a screen we do not list falls on Advanced function. */
export function settingPlace(groupName: string | null, key: string): SettingPlace {
  switch (groupName) {
    case "Account":
      return { area: "account", section: "Account", order: 0 }; // tariffs and notifications belong to the account, not to the inverter
    case "Preferences":
      if (key === "low_noise_mode_enabled") return { area: "advanced", section: "Noise", order: 0 };
      return { area: "basic", section: "Sound and screen", order: 0 };
    case "Energy mode":
      if (key === "solar_sell_enabled" || key === "energy_priority_mode") return { area: "work_mode", section: "Energy mode", order: 0 };
      return { area: "battery", section: "Battery level", order: 3 }; // the backup reserve (Low Batt)
    case "Grid charging":
      return { area: "battery", section: "Grid charge", order: 1 };
    case "Generator charging":
      return { area: "battery", section: "Generator charge", order: 2 };
    case "Grid peak shaving":
      return { area: "work_mode", section: "Grid peak shaving", order: 1 };
    case "Time of Use":
      return { area: "work_mode", section: "Time of use", order: 2 };
    case "Smart load":
      return { area: "gen_port", section: "Smart load", order: 0 };
    default:
      return key.startsWith("time_of_use") ? { area: "work_mode", section: "Time of use", order: 2 } : { area: "advanced", section: "More", order: 9 };
  }
}

export const settingArea = (groupName: string | null, key: string): SettingArea => settingPlace(groupName, key).area;

// ---- equipment that is not there ----------------------------------------------------------------------------------------------

/** What is installed with the inverter, from the categories of the parts under it. */
export interface InstalledParts {
  generator: boolean;
  battery: boolean;
}

export function installedParts(categories: (string | null)[]): InstalledParts {
  const has = (re: RegExp) => categories.some((c) => c !== null && re.test(c));
  return { generator: has(/generator|genset/i), battery: has(/batter/i) };
}

/** The settings of equipment this site does not have are left out, so nobody is shown a generator or battery page for a system without
 *  one: the generator port and generator charging without a generator, the battery pages without a battery. */
export function settingsForInstalled<T extends { key: string; area: SettingArea }>(fields: T[], parts: InstalledParts): T[] {
  return fields.filter((f) => {
    if (!parts.generator && (f.area === "gen_port" || /generator/.test(f.key))) return false;
    if (!parts.battery && f.area === "battery") return false;
    return true;
  });
}
