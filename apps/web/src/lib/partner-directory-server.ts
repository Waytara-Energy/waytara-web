import "server-only";
import { createAnonClient } from "@waytara/supabase/anon";
import { readListedPartners, type ListedPartner } from "./partner-directory";

/**
 * The partners an admin has listed on the Partner Network page. It reads with a cookie-less, signed-out client so the page stays static (the route
 * re-reads it every few minutes). Until the directory function exists in the database, or when it cannot be reached, this is simply an empty list and
 * the map says "be the first partner in this district".
 */
export async function fetchListedPartners(): Promise<ListedPartner[]> {
  try {
    const { data, error } = await createAnonClient().rpc("list_authorized_partners");
    if (error) return [];
    return readListedPartners(data);
  } catch {
    return [];
  }
}
