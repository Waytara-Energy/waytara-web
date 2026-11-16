"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { ONBOARDING_LIMITS, readOnboarding } from "@waytara/supabase/partner-onboarding";
import type { Json } from "@waytara/supabase/types";
import { loadPartnerData, requirePartner } from "@/lib/partner-context";

const field = (fd: FormData, name: string) => String(fd.get(name) ?? "").trim();

/**
 * Saves what a partner may change about themselves: their name and phone, their business details and their team. The application is found from the signed-in
 * account (see requirePartner), never from the form. What they have said about where they work and their past work is left exactly as it is (it is not on this page).
 */
export async function savePartnerProfile(formData: FormData): Promise<void> {
  const { profileId, application } = await requirePartner();
  const contactName = field(formData, "contactName");
  const phone = field(formData, "phone");
  if (contactName.length < 2 || contactName.length > 200) throw new Error("Enter your name.");
  if (phone.length < 6 || phone.length > 32) throw new Error("Enter a phone number we can call you on.");

  const { data: current } = await loadPartnerData(application.id);
  const members = Array.from({ length: ONBOARDING_LIMITS.members }, (_, i) => ({ name: field(formData, `member_name_${i}`), role: field(formData, `member_role_${i}`), certificate: field(formData, `member_cert_${i}`) })).filter(
    (m) => m.name || m.role || m.certificate,
  );
  // readOnboarding is what tidies and cuts everything (lengths, digits only where a number is expected), the same as on the onboarding page
  const next = readOnboarding({
    ...current,
    business: {
      ...current.business,
      name: field(formData, "businessName"),
      address: field(formData, "address"),
      city: field(formData, "city"),
      pin: field(formData, "pin").replace(/\D/g, ""),
      website: field(formData, "website"),
      gstin: field(formData, "gstin").toUpperCase().replace(/[^A-Z0-9]/g, ""),
    },
    team: { size: field(formData, "teamSize").replace(/\D/g, ""), certified: field(formData, "teamCertified").replace(/\D/g, ""), members },
  });
  if (!next.business.name) throw new Error("Enter your business name.");

  const db = createServiceRoleClient();
  const { error } = await db.from("partner_onboarding").upsert({ application_id: application.id, data: next as unknown as Json }, { onConflict: "application_id" });
  if (error) throw new Error("Couldn't save just now. Please try again.");
  // the name in the team's list, and the sign-in account's name and phone, follow what the partner says
  await db.from("partner_applications").update({ company_name: next.business.name, contact_name: contactName, phone }).eq("id", application.id);
  await db.from("profiles").update({ full_name: contactName, phone }).eq("id", profileId);
  revalidatePath("/partner", "layout");
}
