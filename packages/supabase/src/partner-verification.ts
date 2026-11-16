// How an admin screens and verifies a partner application and how a decline is handled. Pure (no framework, no database), shared by the admin app's page, its actions
// and the e-mails, so the wording the admin chooses from and what the applicant is told always match.

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
  { key: "identity", label: "Identity", hint: "The photo ID matches the person we are dealing with." },
  // set by the screening checklist now; kept so applications checked before it still read correctly
  { key: "contact", label: "Phone and e-mail", hint: "We spoke to them on the number they gave, and the e-mail address is theirs." },
  { key: "licence", label: "Licence or certificate", hint: "The licence or certificate is genuine and current, checked with the authority that issued it. For a tie-up, the contractor named holds a current licence." },
  { key: "registration", label: "Business registration", hint: "The business exists as described: the GST number is active on the GST portal and matches the name, and the registration document is in order." },
  { key: "kyc", label: "PAN and KYC", hint: "The PAN is valid and belongs to the business or the person we pay." },
  { key: "bank", label: "Bank account", hint: "The account on the cheque or passbook matches what they entered and is in the name we pay." },
  { key: "work", label: "Past work", hint: "Their past work or references are real." },
];

export interface MemberCheckDef {
  key: MemberCheckKey;
  label: string;
  hint: string;
}

export const MEMBER_CHECKS: readonly MemberCheckDef[] = [
  { key: "member_identity", label: "Identity", hint: "The photo ID matches this person." },
  { key: "member_licence", label: "Licence or certificate", hint: "Their licence or certificate is genuine and current, checked with the authority that issued it." },
];

export const CHECK_STATE_LABEL: Record<CheckState, string> = { pending: "Not checked yet", verified: "Verified", problem: "Problem found" };
export const isCheckKey = (v: unknown): v is CheckKey => CHECKS.some((c) => c.key === v);
export const isMemberCheckKey = (v: unknown): v is MemberCheckKey => MEMBER_CHECKS.some((c) => c.key === v);
export const isCheckState = (v: unknown): v is CheckState => v === "pending" || v === "verified" || v === "problem";

/** Whose check it is: the partner, the screening call, or one team member (by the id their documents are filed under). */
export const SCREENING_SUBJECT = "screening";
export const memberSubject = (key: string): string => `member:${key}`;
export const isSubject = (v: unknown): v is string => typeof v === "string" && (v === "partner" || v === SCREENING_SUBJECT || /^member:[A-Za-z0-9_-]{1,40}$/.test(v));

// ---- screening: the call before onboarding opens ----

export interface ScreeningItem {
  key: string;
  label: string;
  /** What the admin confirms on the call. */
  hint: string;
  /** Must be ticked before the onboarding link can be sent. */
  required: boolean;
}

const LICENSED = "Electrical work must be done by a licensed contractor under a certified supervisor.";

/**
 * What the admin confirms on the screening call, by kind of partner. The first two are what the rest of the flow stands on: the onboarding link and its code go to the
 * e-mail address, and the call proves the phone number.
 */
export function screeningChecklist(partnerType: string | null): ScreeningItem[] {
  const common: ScreeningItem[] = [
    { key: "s_phone", label: "Phone number", hint: "You reached them on the number they gave.", required: true },
    { key: "s_email", label: "E-mail address", hint: "They confirmed the address. The onboarding link and its code go only there.", required: true },
    { key: "s_person", label: "Who they are", hint: "The person and the business are who the application says, and this person can sign for it.", required: true },
    { key: "s_area", label: "Where they work", hint: "The districts they cover, and how far they travel.", required: true },
    { key: "s_work", label: "Work and experience", hint: "What they do, how long, the size of their team and their past work match their answers.", required: true },
  ];
  const byType: Record<string, ScreeningItem[]> = {
    contractor: [
      { key: "s_licence", label: "Contractor licence", hint: `They hold a current TNELB electrical contractor licence; note the grade and number. ${LICENSED}`, required: true },
      { key: "s_gst", label: "GST and business registration", hint: "Whether they are registered for GST, and what kind of business it is.", required: false },
    ],
    solar: [
      { key: "s_licence", label: "Licensed electrical work", hint: `They hold a contractor licence, or work through a licensed contractor (note who). ${LICENSED}`, required: true },
      { key: "s_subsidy", label: "Rooftop solar vendor registration", hint: "Whether they are a registered vendor on the national portal (needed for subsidised home systems under PM Surya Ghar).", required: false },
      { key: "s_gst", label: "GST and business registration", hint: "Whether they are registered for GST, and what kind of business it is.", required: false },
    ],
    ev: [
      { key: "s_licence", label: "Licensed electrical work", hint: `They hold a contractor licence, or work through a licensed contractor (note who). ${LICENSED}`, required: true },
      { key: "s_gst", label: "GST and business registration", hint: "Whether they are registered for GST, and what kind of business it is.", required: false },
    ],
    technician: [{ key: "s_licence", label: "Competency or trade certificate", hint: "They hold a wireman or supervisor competency certificate, or an ITI, diploma or degree; note which.", required: true }],
    survey: [{ key: "s_tools", label: "Tools and rooftop safety", hint: "They have a smartphone and measuring tools, and can work safely on a rooftop.", required: true }],
  };
  return [
    ...common,
    ...(byType[partnerType ?? ""] ?? []),
    { key: "s_documents", label: "Documents explained", hint: "You told them what onboarding asks for: photo ID, PAN, bank proof, licences and certificates, each team member's ID and certificate, and photos of their work.", required: true },
  ];
}

export const isScreeningKey = (partnerType: string | null, v: unknown): boolean => screeningChecklist(partnerType).some((i) => i.key === v);

/** The required screening items not yet ticked (their labels), or an empty list when the onboarding link can be sent. */
export function screeningGaps(partnerType: string | null, ticked: Partial<Record<string, CheckState>>): string[] {
  return screeningChecklist(partnerType)
    .filter((i) => i.required && ticked[i.key] !== "verified")
    .map((i) => i.label);
}

// ---- verification: after they send their onboarding ----

/** The checks that make sense for a kind of partner. A technician or a survey associate has no business to register, and a survey associate holds no licence. */
export function checklistFor(partnerType: string | null): CheckDef[] {
  const skip: CheckKey[] = partnerType === "technician" ? ["contact", "registration"] : partnerType === "survey" ? ["contact", "licence", "registration"] : ["contact"];
  return CHECKS.filter((c) => !skip.includes(c.key));
}

/**
 * The checks that must be Verified before an application can be approved: who they are, the PAN and the bank account for everyone (we cannot pay without them), the
 * licence or certificate for every kind that does electrical work, and the business registration for the kinds that are businesses.
 */
export function requiredChecks(partnerType: string | null): CheckKey[] {
  const business = partnerType === "contractor" || partnerType === "solar" || partnerType === "ev";
  return checklistFor(partnerType)
    .map((c) => c.key)
    .filter((k) => k === "identity" || k === "kyc" || k === "bank" || (k === "licence" && (business || partnerType === "technician")) || (k === "registration" && business));
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
 * What still stands in the way of approving (in the admin's words), or an empty list when it can be approved. The screening call must be done (or, for an application
 * checked before the screening checklist existed, its phone and e-mail check verified); every required check must be Verified; a partner with no team members owes
 * nothing for a team; every person on the team must be verified (identity, and their licence where one is needed), or removed from the team first.
 */
export function approvalGaps(partnerType: string | null, states: Partial<Record<CheckKey, CheckState>>, members: readonly MemberRef[] = [], memberStates: MemberStates = {}, screening: Partial<Record<string, CheckState>> = {}): string[] {
  const label = (k: CheckKey) => CHECKS.find((c) => c.key === k)!.label;
  const gaps: string[] = [];
  if (states.contact !== "verified" && screeningGaps(partnerType, screening).length > 0) gaps.push("Screening call: not complete");
  for (const k of requiredChecks(partnerType)) if (states[k] !== "verified") gaps.push(states[k] === "problem" ? `${label(k)}: a problem was found` : `${label(k)}: not verified yet`);
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
