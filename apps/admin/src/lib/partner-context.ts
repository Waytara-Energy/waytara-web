import { redirect } from "next/navigation";
import { requireRole } from "@waytara/supabase/auth";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { readOnboarding, type OnboardingData } from "@waytara/supabase/partner-onboarding";

export interface PartnerApplication {
  id: string;
  reference: string | null;
  partner_type: string | null;
  company_name: string;
  contact_name: string;
  phone: string;
  email: string;
  created_at: string;
  account_created_at: string | null;
}

export interface PartnerDocumentRow {
  id: string;
  kind: string;
  file_name: string;
  size_bytes: number;
  uploaded_at: string;
}

/**
 * Who a partner page is for. A partner account has no right to read or write anything in the database directly (no policy mentions the role), so the partner pages go
 * through the server's own key, and THIS is what keeps that safe: the application is found from the signed-in account (never from anything in the request, such as an id
 * in the address or a form), and only an approved application with this account tied to it counts. Everything a partner page reads or writes is then scoped to
 * `application.id`. Anyone else (staff, a site engineer, no account) is sent away.
 */
export async function requirePartner(): Promise<{ profileId: string; application: PartnerApplication }> {
  const profile = await requireRole(["partner"]);
  const { data } = await createServiceRoleClient()
    .from("partner_applications")
    .select("id, reference, partner_type, company_name, contact_name, phone, email, created_at, account_created_at")
    .eq("profile_id", profile.id)
    .eq("status", "approved")
    .maybeSingle();
  if (!data) redirect("/unauthorized");
  return { profileId: profile.id, application: data };
}

/** The partner's saved onboarding answers (tidied) and the list of their files (names only: nothing here opens a file). */
export async function loadPartnerData(applicationId: string): Promise<{ data: OnboardingData; documents: PartnerDocumentRow[] }> {
  const db = createServiceRoleClient();
  const [row, docs] = await Promise.all([
    db.from("partner_onboarding").select("data").eq("application_id", applicationId).maybeSingle(),
    db.from("partner_documents").select("id, kind, file_name, size_bytes, uploaded_at").eq("application_id", applicationId).order("uploaded_at", { ascending: true }),
  ]);
  return { data: readOnboarding(row.data?.data), documents: docs.data ?? [] };
}
