"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@waytara/supabase/server";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { getCurrentProfile, requireStaff } from "@waytara/supabase/auth";
import { accessExpiry, newAccessToken } from "@waytara/supabase/partner-access";
import { SCREENING_SUBJECT, approvalGaps, isCheckKey, isCheckState, isDeclineHandling, isMemberCheckKey, isSubject, screeningChecklist, screeningGaps } from "@waytara/supabase/partner-verification";
import { readOnboarding } from "@waytara/supabase/partner-onboarding";
import { loadVerification } from "@/lib/partner-verification-data";
import { sendPartnerClosedEmail, sendPartnerDeclineEmail } from "@/lib/send-partner-decline-email";
import { sendPartnerLinkEmail } from "@/lib/send-partner-link-email";
import { isPartnerStatus } from "@/lib/partners";

/** Sets an application's status, notes and the note the applicant sees, and records who did it and when. Admin only (the row-level rules enforce it too). */
export async function reviewPartnerApplication(id: string, formData: FormData): Promise<void> {
  await requireStaff();
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") redirect("/unauthorized");

  const status = String(formData.get("status") ?? "");
  if (!isPartnerStatus(status)) throw new Error("Choose a status.");
  const notes = String(formData.get("adminNotes") ?? "").trim();
  if (notes.length > 5000) throw new Error("The notes are too long (5000 characters at most).");
  const message = String(formData.get("statusMessage") ?? "").trim();
  if (message.length > 600) throw new Error("The note for the applicant is too long (600 characters at most).");

  const supabase = await createClient();
  // The note's date is when it was last changed, so an unchanged note keeps its date.
  const { data: before } = await supabase.from("partner_applications").select("status, partner_type, status_message, status_message_at, contact_name, email, reference, profile_id").eq("id", id).single();
  // A partner who has an account cannot be moved back a stage (they would still be able to sign in); to stop their access, suspend it.
  if (before?.profile_id && before.status === "approved" && status !== "approved") throw new Error("This partner has an account. To stop their access, use Suspend access in the Partner account box.");
  const messageChanged = (before?.status_message ?? "") !== message;
  // Approving and declining have their own steps (the checklist must be done; a decline asks what happens to the data and sends a last e-mail), so they cannot be
  // reached by picking a status here. An application that already is approved or declined can still be saved as it is.
  if ((status === "approved" || status === "rejected") && before?.status !== status) throw new Error("Use the Approve or Decline buttons for that.");
  // Opening onboarding is the moment the applicant is asked to act, so they get a fresh link in an e-mail that says so (a link cannot be read back, so this is
  // the only way to put one in front of them; the earlier link stops working).
  const opensOnboarding = status === "onboarding" && before?.status !== "onboarding";
  // The onboarding link goes out only after the screening call: every required item of its checklist must be ticked first. (An application that had already reached
  // Verification is only being sent back, so it is not asked again.)
  if (opensOnboarding && before && before.status !== "verification") {
    const v = await loadVerification(supabase, id);
    const open = screeningGaps(before.partner_type, v.screening);
    if (open.length > 0) throw new Error(`Finish the screening call first. Still to confirm: ${open.join(", ")}.`);
  }
  // With an account the partner just signs in, so there is no link to renew; without one (they never confirmed their e-mail) a fresh invite link goes out.
  const access = opensOnboarding && !before?.profile_id ? newAccessToken() : null;

  const { error } = await supabase
    .from("partner_applications")
    .update({
      ...(access ? { access_token_hash: access.hash, access_expires_at: accessExpiry() } : {}),
      status,
      // the two notes are written from the box under the timeline now; this form only changes them if a form that still has those boxes sends them
      ...(formData.has("adminNotes") ? { admin_notes: notes === "" ? null : notes } : {}),
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
      // Shown in the public partner directory only while approved, and only when the box is ticked.
      listed_publicly: status === "approved" && formData.get("listedPublicly") === "on",
      ...(formData.has("statusMessage")
        ? { status_message: message === "" ? null : message, status_message_at: message === "" ? null : messageChanged ? new Date().toISOString() : (before?.status_message_at ?? new Date().toISOString()) }
        : {}),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  // An onboarding the applicant had already sent is opened again (their answers and files stay as they are).
  if (opensOnboarding) await supabase.from("partner_onboarding").update({ submitted_at: null }).eq("application_id", id);
  if (opensOnboarding && before) await sendPartnerLinkEmail({ to: before.email, contactName: before.contact_name, reference: before.reference, token: access?.token, purpose: "onboarding" });

  revalidatePath(`/partners/${id}`);
  revalidatePath("/partners");
}

/**
 * Sends the applicant a new private tracking link. The old one stops working at once (only the new code's hash is kept), which is also how a link that has leaked is
 * closed. Admin only.
 */
export async function resendPartnerTrackingLink(id: string): Promise<void> {
  await requireStaff();
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") redirect("/unauthorized");

  const supabase = await createClient();
  const { data: app, error: readError } = await supabase.from("partner_applications").select("contact_name, email, reference, status, profile_id").eq("id", id).single();
  if (readError || !app) throw new Error("Couldn't find this application.");
  // A declined application's link was closed on purpose; it is not to be brought back.
  if (app.status === "rejected") throw new Error("This application was declined, so its link stays closed.");
  // Once the partner has an account their link has done its job (they sign in instead).
  if (app.profile_id) throw new Error("This partner already has an account, so there is no link to send. They sign in with their e-mail address and password.");
  // Before the screening call is done there is nothing for them to open: the link is first sent by moving the application to Onboarding.
  if (app.status === "new" || app.status === "in_review" || app.status === "shortlisted") throw new Error("The onboarding link is sent when you finish the screening call and move the application to Onboarding.");

  const access = newAccessToken();
  const { error } = await supabase.from("partner_applications").update({ access_token_hash: access.hash, access_expires_at: accessExpiry() }).eq("id", id);
  if (error) throw new Error(error.message);

  await sendPartnerLinkEmail({ to: app.email, contactName: app.contact_name, reference: app.reference, token: access.token, purpose: app.status === "approved" ? "approved" : app.status === "onboarding" ? "onboarding" : "resend" });
  revalidatePath(`/partners/${id}`);
}

/**
 * A note on an application from the box under the timeline. Internal: added to the admins' notes with the author and date (the notes only ever grow here). Otherwise: the
 * note the applicant sees on their page, which replaces the last one (600 characters). Admin only.
 */
export async function postPartnerNote(id: string, formData: FormData): Promise<void> {
  const profile = await requireAdminProfile();
  const text = String(formData.get("text") ?? "").trim();
  const internal = formData.get("internal") === "on";
  if (text.length < 1) throw new Error("Write something first.");
  const supabase = await createClient();
  if (internal) {
    const { data: app } = await supabase.from("partner_applications").select("admin_notes").eq("id", id).single();
    if (!app) throw new Error("Couldn't find this application.");
    const stamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
    const next = `${app.admin_notes ? `${app.admin_notes}\n` : ""}[${stamp}, ${profile.full_name ?? "Admin"}] ${text}`;
    if (next.length > 5000) throw new Error("The internal notes are full (5000 characters). Please tidy them first.");
    const { error } = await supabase.from("partner_applications").update({ admin_notes: next }).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    if (text.length > 600) throw new Error("A note for the applicant can be 600 characters at most.");
    const now = new Date().toISOString();
    const { error } = await supabase.from("partner_applications").update({ status_message: text, status_message_at: now }).eq("id", id);
    if (error) throw new Error(error.message);
  }
  revalidatePath(`/partners/${id}`);
}

const PERMANENT_BAN = "876000h"; // ~100 years: the sign-in service has no literal "forever" (the same as for staff)

/** Stops a partner signing in (the account and everything on it stay as they are), or lets them sign in again. Admin only; the same ban the staff accounts use. */
export async function setPartnerAccess(id: string, allow: boolean): Promise<void> {
  await requireAdminProfile();
  const supabase = await createClient();
  const { data: app } = await supabase.from("partner_applications").select("profile_id").eq("id", id).single();
  if (!app?.profile_id) throw new Error("This partner has no account yet.");
  const service = createServiceRoleClient();
  // never on anything but a partner account: this must not be a way to lock out a member of staff
  const { data: person } = await service.from("profiles").select("role").eq("id", app.profile_id).maybeSingle();
  if (person?.role !== "partner") throw new Error("That account is not a partner account.");
  const { error: banError } = await service.auth.admin.updateUserById(app.profile_id, { ban_duration: allow ? "none" : PERMANENT_BAN });
  if (banError) throw new Error(banError.message);
  const { error } = await service.from("profiles").update({ deactivated_at: allow ? null : new Date().toISOString() }).eq("id", app.profile_id);
  if (error) throw new Error(error.message);
  revalidatePath(`/partners/${id}`);
}

async function requireAdminProfile() {
  await requireStaff();
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") redirect("/unauthorized");
  return profile;
}

/**
 * Sets one item's verification (not checked yet, verified, problem found) with a short note, for the partner or for one of their team members. Who set it and when is
 * recorded on it. The keys and the subject are checked here, so only items that exist can be written.
 */
export async function setPartnerItemCheck(id: string, subject: string, key: string, formData: FormData): Promise<void> {
  const profile = await requireAdminProfile();
  // the screening checklist has its own action (it is saved as a whole)
  if (!isSubject(subject) || subject === SCREENING_SUBJECT) throw new Error("That is not something that can be checked.");
  const forMember = subject !== "partner";
  if (forMember ? !isMemberCheckKey(key) : !isCheckKey(key)) throw new Error("That is not something that can be checked.");
  const state = String(formData.get("state") ?? "pending");
  if (!isCheckState(state)) throw new Error("Choose a state.");
  const note = String(formData.get("note") ?? "").trim();
  if (note.length > 500) throw new Error("The note is too long (500 characters at most).");

  const supabase = await createClient();
  const { error } = await supabase
    .from("partner_item_checks")
    .upsert({ application_id: id, subject, key, state, note: note === "" ? null : note, checked_by: profile.id, checked_at: new Date().toISOString() }, { onConflict: "application_id,subject,key" });
  if (error) throw new Error(error.message);
  revalidatePath(`/partners/${id}`);
}

/**
 * Saves the screening checklist as a whole: for each item of this kind of partner, whether it is ticked and the note beside it. Only the items that changed are
 * written, so who ticked an item and when stays true. Admin only.
 */
export async function saveScreeningChecklist(id: string, formData: FormData): Promise<void> {
  const profile = await requireAdminProfile();
  const supabase = await createClient();
  const { data: app } = await supabase.from("partner_applications").select("partner_type").eq("id", id).single();
  if (!app) throw new Error("Couldn't find this application.");
  const v = await loadVerification(supabase, id);
  const now = new Date().toISOString();
  const rows = [];
  for (const item of screeningChecklist(app.partner_type)) {
    const state = formData.get(`tick_${item.key}`) === "on" ? "verified" : "pending";
    const note = String(formData.get(`note_${item.key}`) ?? "").trim();
    if (note.length > 500) throw new Error(`${item.label}: the note is too long (500 characters at most).`);
    if ((v.screening[item.key] ?? "pending") === state && (v.screeningRows[item.key]?.note ?? "") === note) continue;
    rows.push({ application_id: id, subject: SCREENING_SUBJECT, key: item.key, state, note: note === "" ? null : note, checked_by: profile.id, checked_at: now });
  }
  if (rows.length > 0) {
    const { error } = await supabase.from("partner_item_checks").upsert(rows, { onConflict: "application_id,subject,key" });
    if (error) throw new Error(error.message);
  }
  revalidatePath(`/partners/${id}`);
}

/**
 * The partner's full bank account number, for an admin who needs it (to set up a payment, or to compare it with the cheque). The page shows it with all but the last
 * four digits hidden; this is the only way to see the rest, and each use is written to the access log FIRST: if that cannot be written, the number is not returned.
 */
export async function revealPartnerBankAccount(id: string): Promise<string> {
  const profile = await requireAdminProfile();
  const supabase = await createClient();
  const { data: row } = await supabase.from("partner_onboarding").select("data").eq("application_id", id).maybeSingle();
  const number = readOnboarding(row?.data).bank.accountNumber;
  if (!number) throw new Error("No account number has been entered.");
  const { error } = await supabase.from("partner_document_access").insert({ application_id: id, document_id: null, kind: "bank_account", file_name: "the bank account number", action: "view", accessed_by: profile.id });
  if (error) throw new Error("The number was not shown because the access could not be recorded. Try again in a moment.");
  revalidatePath(`/partners/${id}`);
  return number;
}

/** Adds a screening call to the log: when, who made it, what came of it, notes and the next step. Entries are never changed; a mistake is corrected with another one. */
export async function logScreeningCall(id: string, formData: FormData): Promise<void> {
  const profile = await requireAdminProfile();
  const outcome = String(formData.get("outcome") ?? "");
  if (!["reached", "no_answer", "call_back", "wrong_number"].includes(outcome)) throw new Error("Choose what came of the call.");
  const notes = String(formData.get("notes") ?? "").trim();
  const next = String(formData.get("next_step") ?? "").trim();
  if (notes.length > 2000) throw new Error("The notes are too long (2000 characters at most).");
  if (next.length > 300) throw new Error("The next step is too long (300 characters at most).");
  if (outcome === "reached" && notes.length < 3) throw new Error("Write what you found out on the call.");
  const supabase = await createClient();
  const { error } = await supabase.from("partner_screening_calls").insert({ application_id: id, called_by: profile.id, outcome, notes: notes || null, next_step: next || null });
  if (error) throw new Error(error.message);
  revalidatePath(`/partners/${id}`);
}

/** Shows an approved partner in the public partner directory (business name, kind and districts only), or takes them out of it. Only for an approved partner. */
export async function setPartnerListed(id: string, listed: boolean): Promise<void> {
  await requireAdminProfile();
  const supabase = await createClient();
  const { data: app } = await supabase.from("partner_applications").select("status").eq("id", id).single();
  if (app?.status !== "approved") throw new Error("Only an approved partner can be listed.");
  const { error } = await supabase.from("partner_applications").update({ listed_publicly: listed }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/partners/${id}`);
}

/**
 * Deletes a partner for good, whatever stage they are at: their files, everything they entered, the application and their sign-in account. The reference is typed to
 * confirm. A last e-mail goes first (and if it cannot be sent, nothing is deleted), the same promise the decline makes. Admin only; it cannot be undone.
 */
export async function deletePartner(id: string, formData: FormData): Promise<void> {
  await requireAdminProfile();
  const supabase = await createClient();
  const { data: app } = await supabase.from("partner_applications").select("contact_name, email, reference, profile_id").eq("id", id).single();
  if (!app) throw new Error("Couldn't find this application.");
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== (app.reference ?? "").toUpperCase()) throw new Error("Type the application reference to confirm that everything is deleted.");

  const sent = await sendPartnerClosedEmail({ to: app.email, contactName: app.contact_name, reference: app.reference });
  if (sent === "failed") throw new Error("The final e-mail could not be sent, so nothing was deleted. Try again in a moment.");

  const service = createServiceRoleClient();
  const bucket = service.storage.from("partner-documents");
  const { data: files, error: listError } = await bucket.list(id, { limit: 1000 });
  if (listError) throw new Error(`Their files could not be listed to delete: ${listError.message}. Nothing else was deleted; try again.`);
  if ((files ?? []).length > 0) {
    const { error: removeError } = await bucket.remove((files ?? []).map((f) => `${id}/${f.name}`));
    if (removeError) throw new Error(`Their files could not be deleted: ${removeError.message}. Try again.`);
  }
  const { error: rowError } = await service.from("partner_applications").delete().eq("id", id);
  if (rowError) throw new Error(`The files are deleted, but the application could not be: ${rowError.message}. Try again.`);
  if (app.profile_id) {
    await service.from("profiles").delete().eq("id", app.profile_id);
    const { error: userError } = await service.auth.admin.deleteUser(app.profile_id);
    if (userError) throw new Error(`Everything else is deleted, but their sign-in account could not be: ${userError.message}.`);
  }
  revalidatePath("/partners");
}
/** Moves an application to another stage (the status menu at the top of the page). Approved and declined are not reachable from it: those are the Approve and Decline buttons. */
export async function changePartnerStatus(id: string, status: string): Promise<void> {
  if (!isPartnerStatus(status)) throw new Error("Choose a status.");
  const fd = new FormData();
  fd.set("status", status);
  await reviewPartnerApplication(id, fd);
}
/**
 * Asks the applicant for something more: the application goes back to Onboarding with their answers and files kept, they get a fresh private link in an e-mail that
 * carries the admin's words, and the same words show on their page as the team's note.
 */
export async function requestMorePartnerInfo(id: string, formData: FormData): Promise<void> {
  const profile = await requireAdminProfile();
  const note = String(formData.get("note") ?? "").trim();
  if (note.length < 3) throw new Error("Write what you need from them.");
  if (note.length > 600) throw new Error("That is too long (600 characters at most).");

  const supabase = await createClient();
  const { data: app } = await supabase.from("partner_applications").select("status, contact_name, email, reference, profile_id").eq("id", id).single();
  if (!app) throw new Error("Couldn't find this application.");
  if (app.status !== "verification" && app.status !== "onboarding") throw new Error("You can ask for more once they are in Onboarding or Verification.");

  const access = app.profile_id ? null : newAccessToken();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("partner_applications")
    .update({ status: "onboarding", status_message: note, status_message_at: now, ...(access ? { access_token_hash: access.hash, access_expires_at: accessExpiry() } : {}), reviewed_by: profile.id, reviewed_at: now })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await supabase.from("partner_onboarding").update({ submitted_at: null }).eq("application_id", id);

  await sendPartnerLinkEmail({ to: app.email, contactName: app.contact_name, reference: app.reference, token: access?.token, purpose: "more_info", note });
  revalidatePath(`/partners/${id}`);
  revalidatePath("/partners");
}

/** Approves an application, but only when every check that is required for their kind of partner is Verified. */
export async function approvePartnerApplication(id: string): Promise<void> {
  const profile = await requireAdminProfile();
  const supabase = await createClient();
  const { data: app } = await supabase.from("partner_applications").select("status, partner_type, contact_name, email, reference, profile_id").eq("id", id).single();
  if (!app) throw new Error("Couldn't find this application.");
  if (app.status === "approved") throw new Error("This application is already approved.");
  if (app.status === "rejected") throw new Error("This application was declined.");

  // what has been checked about the partner AND about every person on their team: a partner with no team owes nothing for one, each added person must be verified
  const v = await loadVerification(supabase, id);
  const gaps = approvalGaps(app.partner_type, v.states, v.members, v.memberStates, v.screening);
  if (gaps.length > 0) throw new Error(`Not ready to approve. ${gaps.join("; ")}.`);

  // the team's earlier note (an ask for more, say) is done with once they are approved, so it does not sit beside "You are approved"
  // The applicant is sent a fresh private link (a link cannot be read back, so this is the only way to put one in front of them) that ends at choosing a password.
  // A partner who has an account just signs in (no link). One who never confirmed their e-mail gets a fresh invite link that starts at the e-mail code.
  const access = app.profile_id ? null : newAccessToken();
  const { error } = await supabase
    .from("partner_applications")
    .update({ status: "approved", status_message: null, status_message_at: null, ...(access ? { access_token_hash: access.hash, access_expires_at: accessExpiry() } : {}), reviewed_by: profile.id, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await sendPartnerLinkEmail({ to: app.email, contactName: app.contact_name, reference: app.reference, token: access?.token, purpose: "approved" });
  revalidatePath(`/partners/${id}`);
  revalidatePath("/partners");
}

/**
 * Declines an application, and does what the admin chose with the applicant's data: delete everything, delete the documents and keep the contact details, or keep
 * it all. In every case the applicant's private link is closed. The order is the point:
 *   1. the final e-mail goes out FIRST, and if it fails nothing is changed or deleted (so nobody has data deleted without being told);
 *   2. the application is marked declined and its link closed;
 *   3. then the files in the private bucket, the document rows and the onboarding answers are deleted (the first option also deletes the application itself).
 * The file deletions use the server's own key because no admin login has a delete right on them. If a deletion fails part way, the error is shown and the application
 * stays declined with what is left; running the decline again finishes the job without sending the e-mail a second time.
 */
export async function declinePartnerApplication(id: string, formData: FormData): Promise<void> {
  const profile = await requireAdminProfile();
  const handling = String(formData.get("handling") ?? "");
  if (!isDeclineHandling(handling)) throw new Error("Choose what happens to their data.");

  const supabase = await createClient();
  const { data: app } = await supabase.from("partner_applications").select("status, contact_name, email, reference, profile_id").eq("id", id).single();
  if (!app) throw new Error("Couldn't find this application.");
  if (app.status === "approved") throw new Error("An approved partner cannot be declined here.");
  // Deleting everything cannot be undone, so the reference is typed to confirm.
  if (handling === "delete_all" && String(formData.get("confirm") ?? "").trim().toUpperCase() !== (app.reference ?? "").toUpperCase()) throw new Error("Type the application reference to confirm that everything is deleted.");

  const alreadyDeclined = app.status === "rejected";
  if (!alreadyDeclined) {
    const sent = await sendPartnerDeclineEmail({ to: app.email, contactName: app.contact_name, reference: app.reference, handling });
    if (sent === "failed") throw new Error("The final e-mail could not be sent, so nothing was changed or deleted. Try again in a moment.");
  }

  const now = new Date().toISOString();
  const { error: closeError } = await supabase
    .from("partner_applications")
    .update({
      status: "rejected",
      access_token_hash: null,
      access_expires_at: null,
      status_message: null,
      status_message_at: null,
      listed_publicly: false,
      declined_at: now,
      declined_handling: handling === "delete_all" ? null : handling,
      reviewed_by: profile.id,
      reviewed_at: now,
    })
    .eq("id", id);
  if (closeError) throw new Error(closeError.message);

  if (handling !== "keep") {
    const service = createServiceRoleClient();
    // every file in the application's folder, including any that were uploaded but never recorded
    const bucket = service.storage.from("partner-documents");
    const { data: files, error: listError } = await bucket.list(id, { limit: 1000 });
    if (listError) throw new Error(`The application is declined, but its files could not be listed to delete: ${listError.message}. Run the decline again.`);
    if ((files ?? []).length > 0) {
      const { error: removeError } = await bucket.remove((files ?? []).map((f) => `${id}/${f.name}`));
      if (removeError) throw new Error(`The application is declined, but its files could not be deleted: ${removeError.message}. Run the decline again.`);
    }
    const { error: docsError } = await service.from("partner_documents").delete().eq("application_id", id);
    if (docsError) throw new Error(`The files are deleted, but their records could not be: ${docsError.message}. Run the decline again.`);
    const { error: onboardingError } = await service.from("partner_onboarding").delete().eq("application_id", id);
    if (onboardingError) throw new Error(`The documents are deleted, but the onboarding answers could not be: ${onboardingError.message}. Run the decline again.`);
    if (handling === "delete_all") {
      const { error: rowError } = await service.from("partner_applications").delete().eq("id", id);
      if (rowError) throw new Error(`Everything else is deleted, but the application itself could not be: ${rowError.message}. Run the decline again.`);
    }
  }

  // The partner's sign-in account (if they made one): deleted with everything for the first choice, otherwise closed so they cannot sign in (the e-mail told them so).
  if (app.profile_id) {
    const service = createServiceRoleClient();
    if (handling === "delete_all") {
      await service.from("profiles").delete().eq("id", app.profile_id);
      const { error: userError } = await service.auth.admin.deleteUser(app.profile_id);
      if (userError) throw new Error(`Everything else is deleted, but their sign-in account could not be: ${userError.message}. Run the decline again.`);
    } else {
      await service.auth.admin.updateUserById(app.profile_id, { ban_duration: PERMANENT_BAN });
      await service.from("profiles").update({ deactivated_at: now }).eq("id", app.profile_id);
    }
  }

  revalidatePath("/partners");
  // After deleting everything there is no page for this application any more; the dialog sends the admin back to the list when this returns (a redirect from here would
  // be shown as an error by the toast that wraps the action).
  if (handling !== "delete_all") revalidatePath(`/partners/${id}`);
}
