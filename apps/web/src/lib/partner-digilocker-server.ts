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

/** Starts the partner's own DigiLocker session and returns the link to open. */
export async function startForPartner(applicationId: string): Promise<{ url: string }> {
  return startDigilocker({ db: createServiceRoleClient(), applicationId, subject: "partner", redirectUrl: digilockerRedirectUrl() });
}

/** Where the partner's session stands; completes it (and records the verdicts) when they have agreed. */
export async function refreshForPartner(applicationId: string): Promise<DigilockerView> {
  const db = createServiceRoleClient();
  const state = await loadOnboarding(applicationId);
  const { data: docs } = await db.from("partner_documents").select("id, kind, subject, file_name, storage_path, uploaded_at").eq("application_id", applicationId);
  return refreshDigilocker({
    db,
    applicationId,
    subject: "partner",
    typedName: state.data.person.name,
    docs: docs ?? [],
    download: async (path) => {
      const { data } = await db.storage.from(PARTNER_BUCKET).download(path);
      return data ? Buffer.from(await data.arrayBuffer()) : null;
    },
  });
}

/** The stored state, without asking anyone. */
export const viewForPartner = (applicationId: string): Promise<DigilockerView> => digilockerView(createServiceRoleClient(), applicationId, "partner");
