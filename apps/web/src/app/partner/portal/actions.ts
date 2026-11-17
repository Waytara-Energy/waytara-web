"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { ONBOARDING_LIMITS, ensureMemberIds, isIsoDate, readOnboarding } from "@waytara/supabase/partner-onboarding";
import type { Json } from "@waytara/supabase/types";
import { findSessionRecord } from "@/lib/partner-track-server";
import { loadOnboarding } from "@/lib/partner-onboarding-server";
import { TN_DISTRICTS } from "@/lib/partner-network";
import { sendMail } from "@/lib/send-mail";
import { buildPartnerMessageMail } from "@/lib/partner-mail";

// Every action here finds the partner from the signed-in session (findSessionRecord), never from anything in the request, and reads and writes only that partner's own
// application. The profile and licence pages are for approved partners; Support is open to an applicant too. Files go through the routes under /api/partner/track/me.
async function partner(opts?: { approved?: boolean }) {
  const record = await findSessionRecord();
  if (!record || !record.profileId) throw new Error("Please sign in again.");
  if (opts?.approved && record.status !== "approved") throw new Error("This is available once you are approved.");
  return record;
}
const field = (fd: FormData, name: string) => String(fd.get(name) ?? "").trim();

/** Saves what a partner may change about themselves: name, phone, business details and team. Where they work and their past work are left as they are. */
export async function savePartnerProfile(formData: FormData): Promise<void> {
  const app = await partner({ approved: true });
  const contactName = field(formData, "contactName");
  const phone = field(formData, "phone");
  if (contactName.length < 2 || contactName.length > 200) throw new Error("Enter your name.");
  if (phone.length < 6 || phone.length > 32) throw new Error("Enter a phone number we can call you on.");

  const { data: current } = await loadOnboarding(app.id);
  const members = Array.from({ length: ONBOARDING_LIMITS.members }, (_, i) => ({
    id: field(formData, `member_id_${i}`),
    // not on this form: kept from what is saved for the same person
    phone: current.team.members.find((m) => m.id && m.id === field(formData, `member_id_${i}`))?.phone ?? "",
    email: current.team.members.find((m) => m.id && m.id === field(formData, `member_id_${i}`))?.email ?? "",
    siteRole: current.team.members.find((m) => m.id && m.id === field(formData, `member_id_${i}`))?.siteRole ?? "",
    validUntil: current.team.members.find((m) => m.id && m.id === field(formData, `member_id_${i}`))?.validUntil ?? "",
    name: field(formData, `member_name_${i}`),
    role: field(formData, `member_role_${i}`),
    certificate: field(formData, `member_cert_${i}`),
    needsLicence: formData.get(`member_needs_${i}`) === "yes",
    addedAt: field(formData, `member_added_${i}`),
  })).filter((m) => m.name || m.role || m.certificate);
  const next = ensureMemberIds(readOnboarding({
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
    // only districts of the list count; anything else in the form is dropped
    areas: { districts: formData.getAll("district").map(String).filter((d) => TN_DISTRICTS.includes(d)), capacity: field(formData, "capacity").replace(/\D/g, "") },
    work: {
      installs: field(formData, "installs").replace(/\D/g, ""),
      largest: field(formData, "largest").replace(/[^0-9.]/g, ""),
      summary: field(formData, "summary"),
      projects: Array.from({ length: ONBOARDING_LIMITS.projects }, (_, i) => ({
        title: field(formData, `project_title_${i}`),
        place: field(formData, `project_place_${i}`),
        size: field(formData, `project_size_${i}`).replace(/[^0-9.]/g, ""),
        year: field(formData, `project_year_${i}`).replace(/\D/g, ""),
        note: field(formData, `project_note_${i}`),
        // not on this form: kept from what is saved at the same place in the list, while it is still the same project
        clientType: current.work.projects[i]?.title === field(formData, `project_title_${i}`) ? (current.work.projects[i]?.clientType ?? "") : "",
        specs: current.work.projects[i]?.title === field(formData, `project_title_${i}`) ? (current.work.projects[i]?.specs ?? "") : "",
      })).filter((p) => p.title || p.place || p.size || p.year || p.note),
    },
  }));
  if (next.areas.districts.length === 0) throw new Error("Choose at least one district you work in.");
  if (!next.business.name) throw new Error("Enter your business name.");

  const db = createServiceRoleClient();
  const { error } = await db.from("partner_onboarding").upsert({ application_id: app.id, data: next as unknown as Json }, { onConflict: "application_id" });
  if (error) throw new Error("Couldn't save just now. Please try again.");
  await db.from("partner_applications").update({ company_name: next.business.name, contact_name: contactName, phone }).eq("id", app.id);
  await db.from("profiles").update({ full_name: contactName, phone }).eq("id", app.profileId!);
  revalidatePath("/partner/portal", "layout");
}

/**
 * Saves the licence list. A licence whose kind, class or number changed is something the team has not checked, so the licence check goes back to "not checked yet"
 * with a note; a change to only the 'valid until' date (a renewal) does not, because it is the same licence that was checked.
 */
export async function saveLicences(formData: FormData): Promise<void> {
  const app = await partner({ approved: true });
  const { data: current } = await loadOnboarding(app.id);
  // the date of issue is not on this form: kept from what is saved for the same licence
  const issued = (type: string, number: string) => current.licences.find((c) => c.type === type && c.number.toLowerCase() === number.toLowerCase())?.issuedOn ?? "";
  const entries = Array.from({ length: ONBOARDING_LIMITS.licences }, (_, i) => ({ type: field(formData, `type_${i}`), grade: field(formData, `grade_${i}`), number: field(formData, `number_${i}`), issuedOn: issued(field(formData, `type_${i}`), field(formData, `number_${i}`)), validUntil: field(formData, `valid_${i}`) }));
  const kept = entries.filter((l) => l.type || l.number || l.grade || l.validUntil);
  for (const [i, l] of kept.entries()) {
    if (!l.type || !l.number) throw new Error(`Licence ${i + 1}: choose the kind and give the number.`);
    if (l.validUntil && !isIsoDate(l.validUntil)) throw new Error(`Licence ${i + 1}: enter a valid date.`);
  }
  const next = readOnboarding({ ...current, licences: kept });
  const key = (l: { type: string; grade: string; number: string }) => `${l.type}|${l.grade.toLowerCase()}|${l.number.toLowerCase()}`;
  const before = new Set(current.licences.map(key));
  const after = next.licences.map(key);
  const changedIdentity = after.some((k) => !before.has(k)) || current.licences.some((l) => !after.includes(key(l)));

  const db = createServiceRoleClient();
  const { error } = await db.from("partner_onboarding").upsert({ application_id: app.id, data: next as unknown as Json }, { onConflict: "application_id" });
  if (error) throw new Error("Couldn't save just now. Please try again.");
  if (changedIdentity) {
    await db.from("partner_item_checks").upsert({ application_id: app.id, subject: "partner", key: "licence", state: "pending", note: `Changed by the partner on ${new Date().toISOString().slice(0, 10)}: needs checking again.`, checked_by: null, checked_at: null }, { onConflict: "application_id,subject,key" });
  }
  revalidatePath("/partner/portal", "layout");
}

/** A message to the partnerships team, with the partner as Reply-To. Fails loudly so the partner knows if it did not go. */
export async function sendPartnerMessage(formData: FormData): Promise<void> {
  const app = await partner();
  const subject = field(formData, "subject");
  const message = field(formData, "message");
  if (subject.length < 3 || subject.length > 120) throw new Error("Give your message a short subject (3 to 120 characters).");
  if (message.length < 5 || message.length > 3000) throw new Error("Write your message (5 to 3000 characters).");
  const to = (process.env.PARTNERS_NOTIFICATION_EMAIL || process.env.LEADS_NOTIFICATION_EMAIL || "hello@waytaraenergy.com")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const result = await sendMail(to, buildPartnerMessageMail({ name: app.contactName, email: app.email, company: app.companyName, reference: app.reference, subject, message, adminUrl: process.env.ADMIN_APP_URL || "https://admin.waytaraenergy.com", applicationId: app.id }), undefined, app.email);
  if (result === "failed") throw new Error("We couldn't send your message just now. Please try again, or e-mail us directly.");
}
