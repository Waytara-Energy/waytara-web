import type { Database } from "./types";

export type Role = Database["waytara"]["Tables"]["profiles"]["Row"]["role"];

/** Roles allowed into apps/admin. */
export const STAFF_ROLES: readonly Role[] = ["admin", "employee"];

/**
 * Roles that may sign in to apps/admin: staff; site engineers (the installers), who get only the Support pages there; and partners (approved partner applicants), who get
 * only the /partner pages. Being let in here is NOT being let into the pages: proxy.ts sends a site engineer or a partner to their own pages and nowhere else, and every
 * admin action checks for a staff role itself.
 */
export const ADMIN_APP_ROLES: readonly Role[] = ["admin", "employee", "site_engineer", "partner"];

export function isAdminAppRole(role: Role | null | undefined): boolean {
  return !!role && ADMIN_APP_ROLES.includes(role);
}

export function isStaffRole(role: Role | null | undefined): boolean {
  return !!role && STAFF_ROLES.includes(role);
}

export function isPartnerRole(role: Role | null | undefined): boolean {
  return role === "partner";
}

export function isCustomerRole(role: Role | null | undefined): boolean {
  return role === "customer" || role === "admin";
}
