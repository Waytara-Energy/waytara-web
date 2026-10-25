import type { Database } from "./types";

export type Role = Database["waytara"]["Tables"]["profiles"]["Row"]["role"];

/** Roles allowed into apps/admin. */
export const STAFF_ROLES: readonly Role[] = ["admin", "employee"];

/** Roles that may sign in to apps/admin: staff, and site engineers (the installers), who get only the Support pages there. */
export const ADMIN_APP_ROLES: readonly Role[] = ["admin", "employee", "site_engineer"];

export function isAdminAppRole(role: Role | null | undefined): boolean {
  return !!role && ADMIN_APP_ROLES.includes(role);
}

export function isStaffRole(role: Role | null | undefined): boolean {
  return !!role && STAFF_ROLES.includes(role);
}

export function isCustomerRole(role: Role | null | undefined): boolean {
  return role === "customer" || role === "admin";
}
