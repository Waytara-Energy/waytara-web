import type { Database } from "./types";

export type Role = Database["waytara"]["Tables"]["profiles"]["Row"]["role"];

/** Roles allowed into apps/admin. */
export const STAFF_ROLES: readonly Role[] = ["admin", "employee"];

export function isStaffRole(role: Role | null | undefined): boolean {
  return !!role && STAFF_ROLES.includes(role);
}

export function isCustomerRole(role: Role | null | undefined): boolean {
  return role === "customer";
}
