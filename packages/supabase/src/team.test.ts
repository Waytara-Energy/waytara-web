import { describe, expect, it } from "vitest";
import { MEMBER_SETTINGS_TABS, SUPER_SETTINGS_TABS, isSupportPath, isTeamRole, ROLE_PRESETS, TEAM_PAGES, TEAM_PAGE_KEYS, accessSummary, checkAccess, checkInvite, firstPageHref, isMemberSettingsPath, maskEmail, pageOfPath, roleLabel } from "./team";

const D1 = "d1000000-0000-4000-8000-000000000001";
const D2 = "d2000000-0000-4000-8000-000000000002";
const OTHER = "99999999-9999-4999-8999-999999999999";
const owned = new Set([D1, D2]);
const ctx = { ownEmail: "owner@example.com", owned };
const good = { email: "  Asha@Example.com ", fullName: "  Asha   Rao ", role: "viewer", pages: ["overview", "monitoring"], canSchedule: false, devices: [{ equipmentId: D1, level: "read" }] };

describe("the ready-made roles", () => {
  it("only offer pages that exist, and never the account pages", () => {
    for (const p of Object.values(ROLE_PRESETS)) expect(p.pages.every((k) => TEAM_PAGE_KEYS.includes(k))).toBe(true);
    expect(TEAM_PAGE_KEYS).not.toContain("billing");
    expect(TEAM_PAGE_KEYS).not.toContain("settings");
    expect(TEAM_PAGE_KEYS).not.toContain("support");
  });
  it("go from read-only to operating to managing schedules", () => {
    expect(ROLE_PRESETS.viewer).toMatchObject({ level: "read", canSchedule: false });
    expect(ROLE_PRESETS.operator).toMatchObject({ level: "operate", canSchedule: false });
    expect(ROLE_PRESETS.manager).toMatchObject({ level: "operate", canSchedule: true });
    expect(roleLabel("viewer")).toBe("Viewer");
    expect(roleLabel("custom")).toBe("Custom");
  });
});

describe("an invitation", () => {
  it("is cleaned up: the address lower-cased, the name tidied, the pages put in the dashboard's order", () => {
    const r = checkInvite({ ...good, pages: ["monitoring", "overview"] }, ctx);
    expect(r).toMatchObject({ ok: true, value: { email: "asha@example.com", fullName: "Asha Rao", pages: ["overview", "monitoring"], role: "viewer" } });
  });
  it("refuses a bad or own address", () => {
    expect(checkInvite({ ...good, email: "nope" }, ctx)).toMatchObject({ ok: false });
    expect(checkInvite({ ...good, email: "Owner@Example.com" }, ctx)).toMatchObject({ ok: false, error: "That is your own e-mail address." });
  });
  it("needs a page and a device, and only your own devices", () => {
    expect(checkInvite({ ...good, pages: [] }, ctx)).toMatchObject({ ok: false });
    expect(checkInvite({ ...good, pages: ["billing"] }, ctx)).toMatchObject({ ok: false });
    expect(checkInvite({ ...good, devices: [] }, ctx)).toMatchObject({ ok: false });
    expect(checkInvite({ ...good, devices: [{ equipmentId: OTHER, level: "read" }] }, ctx)).toMatchObject({ ok: false, error: "You can only share devices that are on your own sites." });
    expect(checkInvite({ ...good, devices: [{ equipmentId: "not-an-id", level: "read" }] }, ctx)).toMatchObject({ ok: false });
    expect(checkInvite({ ...good, devices: [{ equipmentId: D1, level: "admin" }] }, ctx)).toMatchObject({ ok: false });
  });
  it("lists a device once, at the higher level, and keeps each device's own level", () => {
    const r = checkAccess({ ...good, devices: [{ equipmentId: D1, level: "read" }, { equipmentId: D1, level: "operate" }, { equipmentId: D2, level: "read" }] }, owned);
    expect(r).toMatchObject({ ok: true });
    if (r.ok) expect(r.value.devices).toEqual([{ equipmentId: D1, level: "operate" }, { equipmentId: D2, level: "read" }]);
  });
  it("lets someone manage scheduled reports only if they can see Reports", () => {
    expect(checkAccess({ ...good, canSchedule: true }, owned)).toMatchObject({ ok: false });
    expect(checkAccess({ ...good, canSchedule: true, pages: ["reports"] }, owned)).toMatchObject({ ok: true, value: { canSchedule: true } });
  });
  it("treats an unknown role as custom, and does not trust a truthy string for the schedule switch", () => {
    expect(checkAccess({ ...good, role: "boss" }, owned)).toMatchObject({ ok: true, value: { role: "custom" } });
    expect(checkAccess({ ...good, canSchedule: "yes", pages: ["reports"] }, owned)).toMatchObject({ ok: true, value: { canSchedule: false } });
  });
});

describe("pages", () => {
  it("maps a path to the page it belongs to", () => {
    expect(pageOfPath("/dashboard")).toBe("overview");
    expect(pageOfPath("/dashboard/")).toBe("overview");
    expect(pageOfPath("/dashboard/monitoring?device=1")).toBe("monitoring");
    expect(pageOfPath("/dashboard/ev-sessions/abc")).toBe("monitoring");
    expect(pageOfPath("/dashboard/analytics")).toBe("performance");
    expect(pageOfPath("/dashboard/sites")).toBe("site");
    expect(pageOfPath("/dashboard/devices")).toBe("devices");
  });
  it("keeps billing, support, settings, onboarding and anything unknown with the owner", () => {
    for (const p of ["/dashboard/settings", "/dashboard/billing", "/dashboard/support", "/dashboard/onboarding-status", "/dashboard/something-new"]) expect(pageOfPath(p)).toBe("owner");
    expect(pageOfPath("/elsewhere")).toBeNull();
  });
  it("picks the first page a member has, in the dashboard's order", () => {
    expect(firstPageHref(["devices", "monitoring"])).toBe("/dashboard/monitoring");
    expect(firstPageHref(TEAM_PAGES.map((p) => p.key))).toBe("/dashboard");
    expect(firstPageHref([])).toBe("/dashboard");
  });
});

describe("how access reads", () => {
  it("summarises in words", () => {
    expect(accessSummary({ role: "operator", pages: ["overview", "devices"], canSchedule: true, devices: [{ level: "operate" }, { level: "read" }] })).toBe("Operator · 2 devices (1 to operate) · 2 pages · schedules");
    expect(accessSummary({ role: "viewer", pages: ["overview"], canSchedule: false, devices: [{ level: "read" }] })).toBe("Viewer · 1 device · 1 page");
  });
  it("masks an address", () => {
    expect(maskEmail("asha.rao@example.com")).toBe("a******@example.com".replace("******", "*".repeat(6)));
    expect(maskEmail("ab@x.in")).toBe("a**@x.in");
  });
});

describe("the Super user role", () => {
  it("is a preset with everything", () => {
    expect(ROLE_PRESETS.super).toMatchObject({ level: "operate", canSchedule: true });
    expect(ROLE_PRESETS.super.pages).toEqual(TEAM_PAGE_KEYS);
    expect(isTeamRole("super")).toBe(true);
  });
  it("needs no device list and no page list: it gets every page, the schedules, and no devices are stored (the database gives them all)", () => {
    const r = checkAccess({ role: "super", fullName: " Asha ", pages: [], devices: [] }, new Set());
    expect(r).toEqual({ ok: true, value: { fullName: "Asha", role: "super", pages: [...TEAM_PAGE_KEYS], canSchedule: true, devices: [] } });
  });
  it("ignores whatever pages or devices are sent with it", () => {
    const r = checkAccess({ role: "super", pages: ["overview"], canSchedule: false, devices: [{ equipmentId: D1, level: "read" }] }, new Set([D1]));
    expect(r.ok && r.value.devices).toEqual([]);
    expect(r.ok && r.value.pages).toEqual([...TEAM_PAGE_KEYS]);
  });
  it("is still a valid invitation, and any other role still needs a device and a page", () => {
    expect(checkInvite({ email: "A@Example.com", role: "super" }, { ownEmail: "o@example.com", owned: new Set() }).ok).toBe(true);
    expect(checkAccess({ role: "manager", pages: ["overview"], devices: [] }, new Set()).ok).toBe(false);
  });
  it("reads as a super user in a list, and may manage the team in Settings", () => {
    expect(roleLabel("super")).toBe("Super user");
    expect(accessSummary({ role: "super", pages: [], canSchedule: true, devices: [] })).toBe("Super user · everything, like the owner");
    expect([...SUPER_SETTINGS_TABS]).toEqual([...MEMBER_SETTINGS_TABS, "team", "alerts"]);
  });
});

describe("what a super user may open besides the dashboard", () => {
  it("opens Support, the list and a ticket, but not another page that merely starts the same", () => {
    expect(isSupportPath("/dashboard/support")).toBe(true);
    expect(isSupportPath("/dashboard/support/")).toBe(true);
    expect(isSupportPath("/dashboard/support/3f9a1c00-0000-0000-0000-000000000000?x=1")).toBe(true);
    expect(isSupportPath("/dashboard/supporter")).toBe(false);
    expect(isSupportPath("/dashboard/settings")).toBe(false);
  });
});

describe("what a team member may open in Application Settings", () => {
  it("is the member's own profile and how the dashboard looks and behaves for them, not the account's notifications, alerts, billing or team", () => {
    expect([...MEMBER_SETTINGS_TABS]).toEqual(["profile", "appearance", "units", "dashboard", "security"]);
    for (const owner of ["account", "notifications", "alerts", "team", "billing", "privacy"]) expect((MEMBER_SETTINGS_TABS as readonly string[]).includes(owner)).toBe(false);
  });
  it("opens Application Settings itself, whatever follows the path, and nothing under it", () => {
    expect(isMemberSettingsPath("/dashboard/settings")).toBe(true);
    expect(isMemberSettingsPath("/dashboard/settings/")).toBe(true);
    expect(isMemberSettingsPath("/dashboard/settings?x=1#security")).toBe(true);
    expect(isMemberSettingsPath("/dashboard/settings/instruments")).toBe(false);
    expect(isMemberSettingsPath("/dashboard/support")).toBe(false);
    expect(isMemberSettingsPath("/dashboard")).toBe(false);
  });
  it("leaves the page rules as they were: Settings is still the owner's page for the pages a member is given", () => {
    expect(pageOfPath("/dashboard/settings")).toBe("owner");
  });
});
