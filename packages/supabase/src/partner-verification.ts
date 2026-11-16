// How an admin verifies a partner application and how a decline is handled. Pure (no framework, no database), shared by the admin app's page, its actions and the
// e-mails, so the wording the admin chooses from and what the applicant is told always match.

export type CheckKey = "identity" | "contact" | "licence" | "registration" | "work" | "kyc" | "bank";
export type MemberCheckKey = "member_identity" | "member_licence";
export type CheckState = "pending" | "verified" | "problem";

export interface CheckDef {
  key: CheckKey;
  label: string;
  /** What the admin is asked to confirm. */
  hint: string;
}

export const CHECKS: readonly CheckDef[] = [
  { key: "identity", label: "Identity", hint: "The identity document matches the person we are dealing with." },
  { key: "contact", label: "Phone and e-mail", hint: "We spoke to them on the number they gave, and the e-mail address is theirs." },
  { key: "licence", label: "Licence or certificate", hint: "The licence is genuine and current, checked with the authority that issued it." },
  { key: "registration", label: "Business registration", hint: "The business exists as described (GST, company or firm registration, Udyam)." },
  { key: "kyc", label: "KYC", hint: "The KYC proofs are genuine and match the business." },
  { key: "bank", label: "Bank details", hint: "The bank account belongs to the business (checked against the cancelled cheque or passbook)." },
  { key: "work", label: "Past work", hint: "Their past work or references are real." },
];

export interface MemberCheckDef {
  key: MemberCheckKey;
  label: string;
  hint: string;
}

export const MEMBER_CHECKS: readonly MemberCheckDef[] = [
  { key: "member_identity", label: "Identity", hint: "The identity document matches this person." },
  { key: "member_licence", label: "Licence or certificate", hint: "Their licence or certificate is genuine and current, checked with the authority that issued it." },
];

export const CHECK_STATE_LABEL: Record<CheckState, string> = { pending: "Not checked yet", verified: "Verified", problem: "Problem found" };
export const isCheckKey = (v: unknown): v is CheckKey => CHECKS.some((c) => c.key === v);
export const isMemberCheckKey = (v: unknown): v is MemberCheckKey => MEMBER_CHECKS.some((c) => c.key === v);
export const isCheckState = (v: unknown): v is CheckState => v === "pending" || v === "verified" || v === "problem";

/** Whose check it is: the partner, or one team member (by the id their documents are filed under). */
export const memberSubject = (key: string): string => `member:${key}`;
export const isSubject = (v: unknown): v is string => typeof v === "string" && (v === "partner" || /^member:[A-Za-z0-9_-]{1,40}$/.test(v));

/** The checks that make sense for a kind of partner. A technician has no business to register, a survey associate holds no licence. */
export function checklistFor(partnerType: string | null): CheckDef[] {
  const skip: CheckKey[] = partnerType === "technician" ? ["registration"] : partnerType === "survey" ? ["licence", "registration"] : [];
  return CHECKS.filter((c) => !skip.includes(c.key));
}

/** The checks that must be Verified before an application can be approved: always who they are and that we reached them, and the licence for those who must hold one. */
export function requiredChecks(partnerType: string | null): CheckKey[] {
  return checklistFor(partnerType)
    .map((c) => c.key)
    .filter((k) => k === "identity" || k === "contact" || (k === "licence" && (partnerType === "contractor" || partnerType === "technician")));
}

/** What a team member is checked on: always their identity, and their licence or certificate when their work needs one. */
export function memberChecklist(needsLicence: boolean): MemberCheckDef[] {
  return MEMBER_CHECKS.filter((c) => c.key === "member_identity" || needsLicence);
}

export interface MemberRef {
  /** The id their documents and checks are filed under (see memberKey). */
  key: string;
  name: string;
  needsLicence: boolean;
}

export type MemberStates = Record<string, Partial<Record<MemberCheckKey, CheckState>>>;

/** Where a team member stands: verified when everything they are checked on is, "problem" when anything is, otherwise pending. */
export function memberStatus(m: MemberRef, states: MemberStates): CheckState {
  const mine = states[m.key] ?? {};
  const list = memberChecklist(m.needsLicence).map((c) => mine[c.key] ?? "pending");
  return list.some((s) => s === "problem") ? "problem" : list.every((s) => s === "verified") ? "verified" : "pending";
}

/**
 * What still stands in the way of approving (in the admin's words), or an empty list when it can be approved. A partner with no team members owes nothing for a team;
 * every person on the team must be verified (identity, and their licence where one is needed), or removed from the team first.
 */
export function approvalGaps(partnerType: string | null, states: Partial<Record<CheckKey, CheckState>>, members: readonly MemberRef[] = [], memberStates: MemberStates = {}): string[] {
  const label = (k: CheckKey) => CHECKS.find((c) => c.key === k)!.label;
  const gaps = requiredChecks(partnerType)
    .filter((k) => states[k] !== "verified")
    .map((k) => (states[k] === "problem" ? `${label(k)}: a problem was found` : `${label(k)}: not verified yet`));
  // a problem on an optional check also stops an approval until it is cleared or explained away by marking it verified
  for (const c of checklistFor(partnerType)) if (states[c.key] === "problem" && !requiredChecks(partnerType).includes(c.key)) gaps.push(`${c.label}: a problem was found`);
  for (const m of members) {
    const status = memberStatus(m, memberStates);
    if (status !== "verified") gaps.push(`${m.name || "A team member"}: ${status === "problem" ? "a problem was found" : "not verified yet"}`);
  }
  return gaps;
}

// ---- declining ----

export type DeclineHandling = "delete_all" | "delete_documents" | "keep";

export interface DeclineOption {
  id: DeclineHandling;
  label: string;
  /** What is deleted and what is kept, for the admin choosing. */
  admin: string;
  /** The sentence the applicant is sent about their data. */
  mail: string;
}

export const DECLINE_OPTIONS: readonly DeclineOption[] = [
  {
    id: "delete_all",
    label: "Delete everything",
    admin: "Deletes the application, its documents, everything they entered and the log of who opened their documents. Nothing is kept, and it cannot be undone.",
    mail: "We have deleted everything we held about this application, including your documents and the details you gave us. This is the last e-mail you will receive about it.",
  },
  {
    id: "delete_documents",
    label: "Delete the documents, keep the contact details",
    admin: "Deletes the uploaded files and everything they entered during onboarding. Keeps their name, phone, e-mail, what they answered when applying, and your notes. It cannot be undone.",
    mail: "We have deleted the documents you sent us and the details you entered during onboarding. We have kept only your name, phone number, e-mail address and what you told us when you applied, so that we can contact you if our network opens in your area. You can ask us at any time to delete those too.",
  },
  {
    id: "keep",
    label: "Keep the details as they are",
    admin: "Deletes nothing. Their documents stay in private storage for follow-up, as the privacy policy says, and can be deleted later on request.",
    mail: "We are keeping your application and documents in private storage only for as long as follow-up needs them. We do not share them with anyone outside WayTara. You can ask us at any time to delete them.",
  },
];

export const DECLINE_LABEL: Record<string, string> = Object.fromEntries(DECLINE_OPTIONS.map((o) => [o.id, o.label]));
export const isDeclineHandling = (v: unknown): v is DeclineHandling => DECLINE_OPTIONS.some((o) => o.id === v);
