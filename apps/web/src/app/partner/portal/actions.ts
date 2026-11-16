"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import {
  DOCUMENT_KIND_IDS,
  DOCUMENT_MAX_FILES,
  ONBOARDING_LIMITS,
  documentMime,
  documentProblem,
  isDocumentPathOf,
  isIsoDate,
  newDocumentPath,
  readOnboarding,
} from "@waytara/supabase/partner-onboarding";
import type { Json } from "@waytara/supabase/types";
import { findSessionRecord } from "@/lib/partner-track-server";
import { loadOnboarding, PARTNER_BUCKET } from "@/lib/partner-onboarding-server";
import { TN_DISTRICTS } from "@/lib/partner-network";
import { sendMail } from "@/lib/send-mail";
import { buildPartnerMessageMail } from "@/lib/partner-mail";

// Every action here finds the partner from the signed-in session (findSessionRecord), never from anything in the request, and reads and writes only that partner's own
// application. The profile and licence pages are for approved partners; Support is open to an applicant too.
async function partner(opts?: { approved?: boolean }) {
  const record = await findSessionRecord();
  if (!record || !record.profileId) throw new Error("Please sign in again.");
  if (opts?.approved && record.status !== "approved") throw new Error("This is available once you are approved.");
  return record;
}
const field = (fd: FormData, name: string) => String(fd.get(name) ?? "").trim();
const isKind = (v: unknown): v is (typeof DOCUMENT_KIND_IDS)[number] => typeof v === "string" && (DOCUMENT_KIND_IDS as readonly string[]).includes(v);
const cleanName = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Saves what a partner may change about themselves: name, phone, business details and team. Where they work and their past work are left as they are. */
export async function savePartnerProfile(formData: FormData): Promise<void> {
  const app = await partner({ approved: true });
  const contactName = field(formData, "contactName");
  const phone = field(formData, "phone");
  if (contactName.length < 2 || contactName.length > 200) throw new Error("Enter your name.");
  if (phone.length < 6 || phone.length > 32) throw new Error("Enter a phone number we can call you on.");

  const { data: current } = await loadOnboarding(app.id);
  const members = Array.from({ length: ONBOARDING_LIMITS.members }, (_, i) => ({ name: field(formData, `member_name_${i}`), role: field(formData, `member_role_${i}`), certificate: field(formData, `member_cert_${i}`) })).filter(
    (m) => m.name || m.role || m.certificate,
  );
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
    // only districts of the list count; anything else in the form is dropped
    areas: { districts: formData.getAll("district").map(String).filter((d) => TN_DISTRICTS.includes(d)), capacity: field(formData, "capacity").replace(/\D/g, "") },
    work: {
      installs: field(formData, "installs").replace(/\D/g, ""),
      largest: field(formData, "largest").replace(/[^0-9.]/g, ""),
      summary: field(formData, "summary"),
      projects: Array.from({ length: ONBOARDING_LIMITS.projects }, (_, i) => ({ title: field(formData, `project_title_${i}`), place: field(formData, `project_place_${i}`), size: field(formData, `project_size_${i}`).replace(/[^0-9.]/g, ""), year: field(formData, `project_year_${i}`).replace(/\D/g, ""), note: field(formData, `project_note_${i}`) })).filter((p) => p.title || p.place || p.size || p.year || p.note),
    },
  });
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
  const entries = Array.from({ length: ONBOARDING_LIMITS.licences }, (_, i) => ({ type: field(formData, `type_${i}`), grade: field(formData, `grade_${i}`), number: field(formData, `number_${i}`), validUntil: field(formData, `valid_${i}`) }));
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
    await db.from("partner_checks").upsert({ application_id: app.id, key: "licence", state: "pending", note: `Changed by the partner on ${new Date().toISOString().slice(0, 10)}: needs checking again.`, checked_by: null, checked_at: null }, { onConflict: "application_id,key" });
  }
  revalidatePath("/partner/portal", "layout");
}

/** Step one of sending a file: if acceptable, a one-time upload address for a fresh path in the private bucket (the file then goes straight from the browser to storage). */
export async function startPartnerUpload(input: { kind: string; name: string; size: number }): Promise<{ path: string; uploadUrl: string }> {
  const app = await partner({ approved: true });
  const name = cleanName(input?.name);
  if (!isKind(input?.kind) || name.length < 1 || name.length > 200 || !Number.isInteger(input?.size)) throw new Error("Please choose the file again.");
  const problem = documentProblem(name, input.size);
  if (problem) throw new Error(problem);
  const db = createServiceRoleClient();
  const { count } = await db.from("partner_documents").select("id", { count: "exact", head: true }).eq("application_id", app.id);
  if ((count ?? 0) >= DOCUMENT_MAX_FILES) throw new Error(`You can keep up to ${DOCUMENT_MAX_FILES} files. Remove one first.`);
  const path = newDocumentPath(app.id, name);
  const { data, error } = await db.storage.from(PARTNER_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error("Couldn't start the upload. Please try again.");
  return { path, uploadUrl: data.signedUrl };
}

/** Step two: the browser says it is uploaded. The server finds the file in the bucket, takes its size from there, refuses and deletes anything unacceptable, and records it. */
export async function finishPartnerUpload(input: { kind: string; name: string; path: string }): Promise<void> {
  const app = await partner({ approved: true });
  const name = cleanName(input?.name);
  const path = typeof input?.path === "string" ? input.path : "";
  if (!isKind(input?.kind) || name.length < 1 || name.length > 200 || path.length > 300) throw new Error("Please choose the file again.");
  if (!isDocumentPathOf(app.id, path)) throw new Error("That file didn't upload properly. Please choose it again.");

  const db = createServiceRoleClient();
  const bucket = db.storage.from(PARTNER_BUCKET);
  const slash = path.indexOf("/");
  const { data: found } = await bucket.list(path.slice(0, slash), { limit: 5, search: path.slice(slash + 1) });
  const file = (found ?? []).find((f) => f.name === path.slice(slash + 1));
  const size = Number((file?.metadata as { size?: number } | null)?.size ?? 0);
  if (!file || !size) throw new Error("That file didn't upload properly. Please choose it again.");
  const problem = documentProblem(name, size);
  if (problem) {
    await bucket.remove([path]);
    throw new Error(problem);
  }
  const { error } = await db.from("partner_documents").insert({ application_id: app.id, kind: input.kind, file_name: name, storage_path: path, content_type: documentMime(name) ?? "application/octet-stream", size_bytes: size });
  if (error) {
    await bucket.remove([path]);
    throw new Error("Couldn't record that file. Please try again.");
  }
  revalidatePath("/partner/portal", "layout");
}

/** Takes back a file the partner sent: the record, then the file. Only a file of their own application can be reached. */
export async function removePartnerDocument(documentId: string): Promise<void> {
  const app = await partner({ approved: true });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(documentId)) throw new Error("Not found.");
  const db = createServiceRoleClient();
  const { data: row } = await db.from("partner_documents").delete().eq("id", documentId).eq("application_id", app.id).select("storage_path").maybeSingle();
  if (!row) throw new Error("Not found.");
  await db.storage.from(PARTNER_BUCKET).remove([row.storage_path]);
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
