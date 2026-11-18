// Team members: people an account owner invites to see (and, device by device, operate) their WayTara system. Pure (no network, no database, no framework): the rules for
// what can be granted, what an invitation must contain, and how a person's access reads, shared by the website's pages, its server actions and the tests.
//
// What a member can be given
//   pages      which of the dashboard's pages they see (Billing, Support and Application Settings are never shared: they stay with the owner)
//   devices    per device: "read" (see its readings, history and alerts, and use live view) or "operate" (also change its settings and start or stop charging)
//   schedules  whether they may create, pause and delete the account's scheduled reports (a separate switch, because a schedule keeps acting after they have gone)
// The database enforces the devices and the schedule switch (a hidden button is not protection); the pages are enforced by the website.

export const TEAM_PAGES = [
  { key: "overview", label: "Overview", href: "/dashboard", hint: "The live energy flow and today's figures" },
  { key: "monitoring", label: "Monitoring", href: "/dashboard/monitoring", hint: "Live readings of the devices" },
  { key: "performance", label: "Performance", href: "/dashboard/performance", hint: "Energy produced, used and saved over time" },
  { key: "reports", label: "Reports", href: "/dashboard/reports", hint: "Download reports; scheduled reports if allowed below" },
  { key: "maintenance", label: "Maintenance", href: "/dashboard/maintenance", hint: "Faults and service history" },
  { key: "site", label: "Site", href: "/dashboard/site", hint: "The site's map and address (view only)" },
  { key: "devices", label: "Devices", href: "/dashboard/devices", hint: "Device details and, with Operate access, their settings" },
] as const;

export type TeamPage = (typeof TEAM_PAGES)[number]["key"];
export const TEAM_PAGE_KEYS: readonly TeamPage[] = TEAM_PAGES.map((p) => p.key);
export const isTeamPage = (v: unknown): v is TeamPage => typeof v === "string" && (TEAM_PAGE_KEYS as readonly string[]).includes(v);

export type DeviceLevel = "read" | "operate";
export const isDeviceLevel = (v: unknown): v is DeviceLevel => v === "read" || v === "operate";

export type TeamRole = "viewer" | "operator" | "manager" | "super" | "custom";
export const TEAM_ROLES: readonly TeamRole[] = ["viewer", "operator", "manager", "super", "custom"];
export const isTeamRole = (v: unknown): v is TeamRole => typeof v === "string" && (TEAM_ROLES as readonly string[]).includes(v);

export interface RolePreset {
  label: string;
  description: string;
  pages: readonly TeamPage[];
  /** What a device is set to when the owner adds it under this role (the owner can change it per device). */
  level: DeviceLevel;
  canSchedule: boolean;
}

/** The ready-made roles. They only fill in sensible defaults when someone is invited; everything can be changed per person afterwards (the role then reads "Custom"). */
export const ROLE_PRESETS: Record<Exclude<TeamRole, "custom">, RolePreset> = {
  viewer: {
    label: "Viewer",
    description: "Sees the system and its history. Cannot change anything.",
    pages: ["overview", "monitoring", "performance", "reports", "maintenance", "site", "devices"],
    level: "read",
    canSchedule: false,
  },
  operator: {
    label: "Operator",
    description: "Sees the system and runs the devices they are given: settings, charging.",
    pages: ["overview", "monitoring", "performance", "reports", "maintenance", "site", "devices"],
    level: "operate",
    canSchedule: false,
  },
  manager: {
    label: "Manager",
    description: "Operates the devices and also manages scheduled reports.",
    pages: ["overview", "monitoring", "performance", "reports", "maintenance", "site", "devices"],
    level: "operate",
    canSchedule: true,
  },
  super: {
    label: "Super user",
    description: "Everything, like the owner: every page, every device (new ones too) to operate, scheduled reports, and managing the team.",
    pages: ["overview", "monitoring", "performance", "reports", "maintenance", "site", "devices"],
    level: "operate",
    canSchedule: true,
  },
};

export const roleLabel = (role: string): string => (role === "custom" ? "Custom" : ROLE_PRESETS[role as keyof typeof ROLE_PRESETS]?.label ?? role);

/** How long an invitation link works. */
export const TEAM_INVITE_DAYS = 14;
export const TEAM_MAX_MEMBERS = 25;

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

export interface TeamInviteDevice {
  equipmentId: string;
  level: DeviceLevel;
}

export interface TeamAccessInput {
  fullName: string | null;
  role: TeamRole;
  pages: TeamPage[];
  canSchedule: boolean;
  devices: TeamInviteDevice[];
}

export interface TeamInvite extends TeamAccessInput {
  email: string;
}

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The access part of an invitation, checked: the same rules when someone is invited and when their access is changed. `owned` is every device the owner may share. */
export function checkAccess(input: unknown, owned: ReadonlySet<string>): Checked<TeamAccessInput> {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const fullName = typeof o.fullName === "string" ? o.fullName.trim().replace(/\s+/g, " ").slice(0, 120) : "";
  const role = isTeamRole(o.role) ? o.role : "custom";

  // A super user has everything: every page, the scheduled reports, and every device of the owner (the database gives those, new ones too), so none is listed.
  if (role === "super") return { ok: true, value: { fullName: fullName || null, role, pages: [...TEAM_PAGE_KEYS], canSchedule: true, devices: [] } };

  const pagesRaw = Array.isArray(o.pages) ? o.pages : [];
  if (pagesRaw.some((p) => !isTeamPage(p))) return { ok: false, error: "One of the pages chosen is not one that can be shared." };
  const pages = TEAM_PAGE_KEYS.filter((k) => pagesRaw.includes(k));
  if (pages.length === 0) return { ok: false, error: "Choose at least one page for this person to see." };

  const devicesRaw = Array.isArray(o.devices) ? o.devices : [];
  const seen = new Map<string, DeviceLevel>();
  for (const d of devicesRaw) {
    const r = (d && typeof d === "object" ? d : {}) as Record<string, unknown>;
    if (typeof r.equipmentId !== "string" || !UUID.test(r.equipmentId) || !isDeviceLevel(r.level)) return { ok: false, error: "A device in the list is not valid." };
    if (!owned.has(r.equipmentId)) return { ok: false, error: "You can only share devices that are on your own sites." };
    // the higher level wins if a device is listed twice
    if (seen.get(r.equipmentId) !== "operate") seen.set(r.equipmentId, r.level);
  }
  if (seen.size === 0) return { ok: false, error: "Choose at least one device for this person to see." };

  const canSchedule = o.canSchedule === true;
  if (canSchedule && !pages.includes("reports")) return { ok: false, error: "To let someone manage scheduled reports, they also need the Reports page." };

  return { ok: true, value: { fullName: fullName || null, role, pages, canSchedule, devices: [...seen].map(([equipmentId, level]) => ({ equipmentId, level })) } };
}

/** A whole invitation: the e-mail address as well. */
export function checkInvite(input: unknown, ctx: { ownEmail: string; owned: ReadonlySet<string> }): Checked<TeamInvite> {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const email = typeof o.email === "string" ? o.email.trim().toLowerCase() : "";
  if (!EMAIL.test(email) || email.length > 254) return { ok: false, error: "Please enter a valid e-mail address." };
  if (email === ctx.ownEmail.trim().toLowerCase()) return { ok: false, error: "That is your own e-mail address." };
  const access = checkAccess(input, ctx.owned);
  if (!access.ok) return access;
  return { ok: true, value: { email, ...access.value } };
}

/** The page of the dashboard a path belongs to, "owner" for the pages that are never shared, or null for anything else. */
export function pageOfPath(pathname: string): TeamPage | "owner" | null {
  const p = pathname.replace(/[?#].*$/, "").replace(/\/+$/, "") || "/";
  if (p === "/dashboard") return "overview";
  const m = p.match(/^\/dashboard\/([^/]+)/);
  if (!m) return null;
  switch (m[1]) {
    case "weather":
      return "overview";
    case "monitoring":
    case "ev-sessions":
      return "monitoring";
    case "performance":
    case "analytics":
      return "performance";
    case "reports":
      return "reports";
    case "maintenance":
      return "maintenance";
    case "site":
    case "sites":
      return "site";
    case "devices":
      return "devices";
    case "settings":
    case "billing":
    case "support":
    case "onboarding-status":
      return "owner";
    default:
      return "owner";
  }
}

/**
 * The tabs of Application Settings a team member may use: their own profile and how the dashboard looks and behaves for them. The account's notifications, alerts,
 * billing, team and data stay with the owner.
 */
export const MEMBER_SETTINGS_TABS = ["profile", "appearance", "units", "dashboard", "security"] as const;
/** A super user also manages the team (the owner's other tabs, billing, alerts and notifications, are tied to the owner's own sign-in). */
export const SUPER_SETTINGS_TABS = [...MEMBER_SETTINGS_TABS, "team"] as const;
export type MemberSettingsTab = (typeof MEMBER_SETTINGS_TABS)[number];

/** Application Settings itself (and nothing under it, such as the old device-settings page) is open to a team member. */
export function isMemberSettingsPath(pathname: string): boolean {
  return (pathname.replace(/[?#].*$/, "").replace(/\/+$/, "") || "/") === "/dashboard/settings";
}

/** Where a member lands: the first of their pages, in the dashboard's own order. */
export function firstPageHref(pages: readonly string[]): string {
  const first = TEAM_PAGES.find((p) => pages.includes(p.key));
  return first ? first.href : "/dashboard";
}

/** What a member's access is, in words for a list: "Viewer · 2 devices · 5 pages". */
export function accessSummary(a: { role: string; pages: readonly string[]; canSchedule: boolean; devices: readonly { level: DeviceLevel }[] }): string {
  if (a.role === "super") return "Super user · everything, like the owner";
  const operate = a.devices.filter((d) => d.level === "operate").length;
  const parts = [
    roleLabel(a.role),
    `${a.devices.length} ${a.devices.length === 1 ? "device" : "devices"}${operate > 0 ? ` (${operate} to operate)` : ""}`,
    `${a.pages.length} ${a.pages.length === 1 ? "page" : "pages"}`,
  ];
  if (a.canSchedule) parts.push("schedules");
  return parts.join(" · ");
}

/** p***@example.com: enough to recognise an address, not enough to learn it. */
export const maskEmail = (email: string): string => {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 1)}${"*".repeat(Math.max(2, Math.min(6, local.length - 1)))}@${domain}`;
};
