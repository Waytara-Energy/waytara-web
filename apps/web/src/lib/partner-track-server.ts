import "server-only";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { hashAccessToken, isPlausibleAccessToken } from "@waytara/supabase/partner-access";

/** What the tracking page may know about an application: their first name, the reference, the kind, the date, the stage and the team's note. Nothing else is read. */
export interface TrackedApplication {
  reference: string | null;
  partnerType: string | null;
  firstName: string;
  status: string;
  appliedOn: string;
  message: string | null;
  messageAt: string | null;
}

/**
 * Opens the application a tracking link belongs to. The link's code is hashed and looked up, and must not have expired; a code that is the wrong shape, unknown,
 * expired or replaced all give the same answer (null), so a page cannot be used to find out which. The public role cannot read this table, so the read is made
 * with the server's own key, here only, and returns only the few fields above.
 */
export async function getTrackedApplication(token: string): Promise<TrackedApplication | null> {
  if (!isPlausibleAccessToken(token)) return null;
  try {
    const { data, error } = await createServiceRoleClient()
      .from("partner_applications")
      .select("reference, partner_type, contact_name, status, created_at, status_message, status_message_at")
      .eq("access_token_hash", hashAccessToken(token))
      .gt("access_expires_at", new Date().toISOString())
      .maybeSingle();
    if (error || !data) return null;
    return {
      reference: data.reference,
      partnerType: data.partner_type,
      firstName: data.contact_name.trim().split(/\s+/)[0] || "there",
      status: data.status,
      appliedOn: data.created_at,
      message: data.status_message,
      messageAt: data.status_message_at,
    };
  } catch {
    return null;
  }
}
