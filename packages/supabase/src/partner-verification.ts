// How an admin verifies a partner application and how a decline is handled. Pure (no framework, no database), shared by the admin app's page, its actions and the
// e-mails, so the wording the admin chooses from and what the applicant is told always match.

export type CheckKey = "identity" | "contact" | "licence" | "registration" | "work";
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
  { key: "work", label: "Past work", hint: "Their past work or references are real." },
];

export const CHECK_STATE_LABEL: Record<CheckState, string> = { pending: "Not checked yet", verified: "Verified", problem: "Problem found" };
export const isCheckKey = (v: unknown): v is CheckKey => CHECKS.some((c) => c.key === v);
export const isCheckState = (v: unknown): v is CheckState => v === "pending" || v === "verified" || v === "problem";

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

/** What still stands in the way of approving (in the admin's words), or an empty list when it can be approved. */
export function approvalGaps(partnerType: string | null, states: Partial<Record<CheckKey, CheckState>>): string[] {
  const label = (k: CheckKey) => CHECKS.find((c) => c.key === k)!.label;
  const gaps = requiredChecks(partnerType)
    .filter((k) => states[k] !== "verified")
    .map((k) => (states[k] === "problem" ? `${label(k)}: a problem was found` : `${label(k)}: not verified yet`));
  // a problem on an optional check also stops an approval until it is cleared or explained away by marking it verified
  for (const c of checklistFor(partnerType)) if (states[c.key] === "problem" && !requiredChecks(partnerType).includes(c.key)) gaps.push(`${c.label}: a problem was found`);
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
