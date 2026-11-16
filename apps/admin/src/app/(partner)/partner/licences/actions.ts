"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { DOCUMENT_KIND_IDS, DOCUMENT_MAX_FILES, ONBOARDING_LIMITS, documentMime, documentProblem, isDocumentPathOf, isIsoDate, newDocumentPath, readOnboarding } from "@waytara/supabase/partner-onboarding";
import type { Json } from "@waytara/supabase/types";
import { loadPartnerData, requirePartner } from "@/lib/partner-context";

const BUCKET = "partner-documents";
const field = (fd: FormData, name: string) => String(fd.get(name) ?? "").trim();

/**
 * Saves the partner's licence list. A licence whose kind, class or number changed is something the team has not checked, so the licence check goes back to "not
 * checked yet" with a note saying when and why; a change to only the 'valid until' date (a renewal) does not, because the same licence is still the one that was checked.
 */
export async function saveLicences(formData: FormData): Promise<void> {
  const { application } = await requirePartner();
  const { data: current } = await loadPartnerData(application.id);

  const entries = Array.from({ length: ONBOARDING_LIMITS.licences }, (_, i) => ({ type: field(formData, `type_${i}`), grade: field(formData, `grade_${i}`), number: field(formData, `number_${i}`), validUntil: field(formData, `valid_${i}`) }));
  const kept = entries.filter((l) => l.type || l.number || l.grade || l.validUntil);
  for (const [i, l] of kept.entries()) {
    if (!l.type || !l.number) throw new Error(`Licence ${i + 1}: choose the kind and give the number.`);
    if (l.validUntil && !isIsoDate(l.validUntil)) throw new Error(`Licence ${i + 1}: enter a valid date.`);
  }
  const next = readOnboarding({ ...current, licences: kept });

  const key = (l: { type: string; grade: string; number: string }) => `${l.type}|${l.grade.toLowerCase()}|${l.number.toLowerCase()}`;
  const before = new Set(current.licences.map(key));
  const changedIdentity = next.licences.some((l) => !before.has(key(l))) || current.licences.some((l) => !next.licences.map(key).includes(key(l)));

  const db = createServiceRoleClient();
  const { error } = await db.from("partner_onboarding").upsert({ application_id: application.id, data: next as unknown as Json }, { onConflict: "application_id" });
  if (error) throw new Error("Couldn't save just now. Please try again.");
  if (changedIdentity) {
    await db.from("partner_checks").upsert({ application_id: application.id, key: "licence", state: "pending", note: `Changed by the partner on ${new Date().toISOString().slice(0, 10)}: needs checking again.`, checked_by: null, checked_at: null }, { onConflict: "application_id,key" });
  }
  revalidatePath("/partner", "layout");
}

const isKind = (v: unknown): v is (typeof DOCUMENT_KIND_IDS)[number] => typeof v === "string" && (DOCUMENT_KIND_IDS as readonly string[]).includes(v);
const cleanName = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Step one of sending a file: if it is acceptable, a one-time upload address for a fresh path in the private bucket (the file then goes straight from the browser to storage). */
export async function startPartnerUpload(input: { kind: string; name: string; size: number }): Promise<{ path: string; uploadUrl: string }> {
  const { application } = await requirePartner();
  const name = cleanName(input?.name);
  if (!isKind(input?.kind) || name.length < 1 || name.length > 200 || !Number.isInteger(input?.size)) throw new Error("Please choose the file again.");
  const problem = documentProblem(name, input.size);
  if (problem) throw new Error(problem);
  const db = createServiceRoleClient();
  const { count } = await db.from("partner_documents").select("id", { count: "exact", head: true }).eq("application_id", application.id);
  if ((count ?? 0) >= DOCUMENT_MAX_FILES) throw new Error(`You can keep up to ${DOCUMENT_MAX_FILES} files. Remove one first.`);
  const path = newDocumentPath(application.id, name);
  const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error("Couldn't start the upload. Please try again.");
  return { path, uploadUrl: data.signedUrl };
}

/** Step two: the browser says it is uploaded. The server finds the file in the bucket, takes its size from there, refuses and deletes anything unacceptable, and records it. */
export async function finishPartnerUpload(input: { kind: string; name: string; path: string }): Promise<void> {
  const { application } = await requirePartner();
  const kind = input?.kind;
  const name = cleanName(input?.name);
  const path = typeof input?.path === "string" ? input.path : "";
  if (!isKind(kind) || name.length < 1 || name.length > 200 || path.length > 300) throw new Error("Please choose the file again.");
  if (!isDocumentPathOf(application.id, path)) throw new Error("That file didn't upload properly. Please choose it again.");

  const db = createServiceRoleClient();
  const bucket = db.storage.from(BUCKET);
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
  const { error } = await db.from("partner_documents").insert({ application_id: application.id, kind, file_name: name, storage_path: path, content_type: documentMime(name) ?? "application/octet-stream", size_bytes: size });
  if (error) {
    await bucket.remove([path]);
    throw new Error("Couldn't record that file. Please try again.");
  }
  revalidatePath("/partner", "layout");
}

/** Takes back a file the partner sent: the record, then the file. Only a file of their own application can be reached. */
export async function removePartnerDocument(documentId: string): Promise<void> {
  const { application } = await requirePartner();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(documentId)) throw new Error("Not found.");
  const db = createServiceRoleClient();
  const { data: row } = await db.from("partner_documents").delete().eq("id", documentId).eq("application_id", application.id).select("storage_path").maybeSingle();
  if (!row) throw new Error("Not found.");
  await db.storage.from(BUCKET).remove([row.storage_path]);
  revalidatePath("/partner", "layout");
}
