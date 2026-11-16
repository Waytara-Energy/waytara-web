import "server-only";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { readOnboarding, type OnboardingData, type OnboardingDocument } from "@waytara/supabase/partner-onboarding";

export const PARTNER_BUCKET = "partner-documents";

export interface OnboardingState {
  data: OnboardingData;
  submittedAt: string | null;
  documents: OnboardingDocument[];
}

/** An application's saved onboarding answers and its document list (empty ones when nothing is saved yet). */
export async function loadOnboarding(applicationId: string): Promise<OnboardingState> {
  const db = createServiceRoleClient();
  const [row, docs] = await Promise.all([
    db.from("partner_onboarding").select("data, submitted_at").eq("application_id", applicationId).maybeSingle(),
    db.from("partner_documents").select("id, kind, subject, file_name, size_bytes, uploaded_at").eq("application_id", applicationId).order("uploaded_at", { ascending: true }),
  ]);
  return {
    data: readOnboarding(row.data?.data),
    submittedAt: row.data?.submitted_at ?? null,
    documents: (docs.data ?? []).map((d) => ({ id: d.id, kind: d.kind, subject: d.subject, name: d.file_name, size: d.size_bytes, uploadedAt: d.uploaded_at })),
  };
}
