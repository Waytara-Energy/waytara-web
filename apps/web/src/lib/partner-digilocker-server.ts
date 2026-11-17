import "server-only";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { digilockerView, refreshDigilocker, startDigilocker, type DigilockerView } from "@waytara/supabase/partner-digilocker";
import { PARTNER_BUCKET, loadOnboarding } from "@/lib/partner-onboarding-server";

/**
 * Where DigiLocker sends the person after they have agreed (or declined). Cashfree requires https, so on a developer's machine the live site's page is used: nothing depends
 * on it (the page the person came from asks for the status itself), it only tells them to go back to their application.
 */
export function digilockerRedirectUrl(): string {
  const set = process.env.DIGILOCKER_REDIRECT_URL?.trim();
  if (set && /^https:\/\//i.test(set)) return set;
  const base = (process.env.CUSTOMER_APP_URL?.trim() || "https://www.waytaraenergy.com").replace(/\/+$/, "");
  return `${/^https:\/\//i.test(base) ? base : "https://www.waytaraenergy.com"}/partner/digilocker-done`;
}

/** Starts a DigiLocker session for the partner ("partner") or for one person on their team ("member:<key>") and returns the link to open. */
export async function startFor(applicationId: string, subject: string): Promise<{ url: string }> {
  return startDigilocker({ db: createServiceRoleClient(), applicationId, subject, redirectUrl: digilockerRedirectUrl() });
}

/**
 * Where a session stands; completes it (and records the verdicts) when the person has agreed. `typedName` is the name to compare with DigiLocker's: the one the partner typed
 * for themselves, or the one the partner gave for the team member. The selfie compared is the one filed under the same subject.
 */
export async function refreshFor(applicationId: string, subject: string, typedName: string): Promise<DigilockerView> {
  const db = createServiceRoleClient();
  const { data: docs } = await db.from("partner_documents").select("id, kind, subject, file_name, storage_path, uploaded_at").eq("application_id", applicationId).eq("subject", subject);
  return refreshDigilocker({
    db,
    applicationId,
    subject,
    typedName,
    docs: docs ?? [],
    download: async (path) => {
      const { data } = await db.storage.from(PARTNER_BUCKET).download(path);
      return data ? Buffer.from(await data.arrayBuffer()) : null;
    },
  });
}

export const startForPartner = (applicationId: string) => startFor(applicationId, "partner");

/** The partner's own session: compared with the name they typed for themselves. */
export async function refreshForPartner(applicationId: string): Promise<DigilockerView> {
  const state = await loadOnboarding(applicationId);
  return refreshFor(applicationId, "partner", state.data.person.name);
}

/** The stored state, without asking anyone. */
export const viewFor = (applicationId: string, subject: string): Promise<DigilockerView> => digilockerView(createServiceRoleClient(), applicationId, subject);
export const viewForPartner = (applicationId: string) => viewFor(applicationId, "partner");
