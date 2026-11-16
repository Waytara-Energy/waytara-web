// What a shortlisted partner applicant tells us on the onboarding page, and the rules for the documents they upload. Pure (no framework, no database), shared by the
// website (which saves and checks it) and the admin app (which reads it), so the two always agree on the shape.

export const DOCUMENT_KINDS = [
  { id: "licence", label: "Licence", hint: "Your contractor licence or permit" },
  { id: "certificate", label: "Competency certificate", hint: "Wireman, supervisor or another technical certificate" },
  { id: "registration", label: "Business registration", hint: "GST, company or firm registration, or Udyam" },
  { id: "identity", label: "Identity of the person we deal with", hint: "A government photo ID. You may hide all but the last four digits of any number." },
  { id: "insurance", label: "Insurance", hint: "Workers' or liability cover, if you have it" },
  { id: "work_photo", label: "Photos of your work", hint: "Finished installations" },
  { id: "other", label: "Anything else", hint: "Another document you want us to see" },
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number]["id"];
export const DOCUMENT_KIND_IDS = DOCUMENT_KINDS.map((k) => k.id) as [DocumentKind, ...DocumentKind[]];
export const DOCUMENT_KIND_LABEL: Record<string, string> = Object.fromEntries(DOCUMENT_KINDS.map((k) => [k.id, k.label]));

/** The most one file may weigh (the bucket enforces the same number), and the most files one applicant may send. */
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_MAX_FILES = 30;

const TYPES: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** The kind of file a name says it is, or null when we do not take that kind. */
export function documentMime(fileName: string): string | null {
  const ext = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return ext ? (TYPES[ext] ?? null) : null;
}

/** Why a file cannot be taken (in words the applicant reads), or null when it can. */
export function documentProblem(fileName: string, size: number): string | null {
  if (!documentMime(fileName)) return "We take PDF, JPG, PNG or WebP files only.";
  if (!(size > 0)) return "That file is empty.";
  if (size > DOCUMENT_MAX_BYTES) return "That file is over 10 MB. Please send a smaller one.";
  return null;
}

/** A file name made safe for a storage path: letters, digits, dot, dash, underscore; never longer than 80 characters; the extension kept. */
export function safeFileName(name: string): string {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[0] ?? "";
  const stem = name.slice(0, name.length - ext.length).replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "");
  return `${(stem || "file").slice(0, 80 - ext.length)}${ext}`;
}

/** Where a file goes in the bucket: the application's folder, a random part so a name can never clash or be guessed, and the safe name. */
export function newDocumentPath(applicationId: string, fileName: string, random: string = crypto.randomUUID()): string {
  return `${applicationId}/${random}-${safeFileName(fileName)}`;
}

/** The shape of a path this module makes, for an application: used to refuse any path that is not one of ours. */
export function isDocumentPathOf(applicationId: string, path: string): boolean {
  return path.startsWith(`${applicationId}/`) && /^[0-9a-f-]{36}\/[0-9a-f-]{36}-[A-Za-z0-9._-]{1,80}$/.test(path);
}

// ---- the sections ----

export const BUSINESS_KINDS = [
  { id: "individual", label: "Individual (working on my own)" },
  { id: "proprietorship", label: "Proprietorship" },
  { id: "partnership", label: "Partnership firm" },
  { id: "llp", label: "Limited liability partnership" },
  { id: "company", label: "Private or public limited company" },
  { id: "other", label: "Something else" },
] as const;

export const LICENCE_TYPES = [
  { id: "contractor", label: "Electrical contractor licence" },
  { id: "supervisor", label: "Supervisor certificate" },
  { id: "wireman", label: "Wireman certificate" },
  { id: "empanelment", label: "Empanelment (for example with a distribution company or a government agency)" },
  { id: "other", label: "Other licence or registration" },
] as const;

export interface BusinessSection {
  name: string;
  kind: string;
  /** The year they started, as typed. */
  started: string;
  address: string;
  city: string;
  pin: string;
  website: string;
  gstin: string;
}

export interface LicenceEntry {
  type: string;
  /** The class or grade, as printed on it. */
  grade: string;
  number: string;
  /** yyyy-mm-dd */
  validUntil: string;
}

export interface TeamMember {
  name: string;
  role: string;
  certificate: string;
}

export interface TeamSection {
  size: string;
  /** How many of them hold a licence or certificate. */
  certified: string;
  members: TeamMember[];
}

export interface AreasSection {
  districts: string[];
  /** Jobs they can take on in a month, as typed. */
  capacity: string;
}

export interface WorkProject {
  title: string;
  place: string;
  /** kW, as typed. */
  size: string;
  year: string;
  note: string;
}

export interface WorkSection {
  installs: string;
  largest: string;
  summary: string;
  projects: WorkProject[];
}

export interface OnboardingData {
  business: BusinessSection;
  licences: LicenceEntry[];
  team: TeamSection;
  areas: AreasSection;
  work: WorkSection;
}

/** A document as the applicant sees it: what it is and what it was called. Never where it is stored: they cannot open it again, only add or remove one. */
export interface OnboardingDocument {
  id: string;
  kind: string;
  name: string;
  size: number;
  uploadedAt: string;
}

export const ONBOARDING_LIMITS = { licences: 10, members: 15, projects: 8, districts: 40 } as const;

export function emptyOnboarding(): OnboardingData {
  return {
    business: { name: "", kind: "", started: "", address: "", city: "", pin: "", website: "", gstin: "" },
    licences: [],
    team: { size: "", certified: "", members: [] },
    areas: { districts: [], capacity: "" },
    work: { installs: "", largest: "", summary: "", projects: [] },
  };
}

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const arr = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/**
 * Turns whatever is stored (or sent) into a well-formed OnboardingData: unknown fields dropped, wrong types turned into empty text, long text cut, long lists cut.
 * It never throws, so an old or odd row still shows. Used on the way in (to save) and on the way out (to show).
 */
export function readOnboarding(raw: unknown): OnboardingData {
  const r = obj(raw);
  const b = obj(r.business);
  const t = obj(r.team);
  const a = obj(r.areas);
  const w = obj(r.work);
  return {
    business: {
      name: str(b.name, 200),
      kind: str(b.kind, 40),
      started: str(b.started, 4),
      address: str(b.address, 400),
      city: str(b.city, 100),
      pin: str(b.pin, 6),
      website: str(b.website, 300),
      gstin: str(b.gstin, 15),
    },
    licences: arr(r.licences, ONBOARDING_LIMITS.licences).map((x) => {
      const o = obj(x);
      return { type: str(o.type, 40), grade: str(o.grade, 60), number: str(o.number, 60), validUntil: str(o.validUntil, 10) };
    }),
    team: {
      size: str(t.size, 6),
      certified: str(t.certified, 6),
      members: arr(t.members, ONBOARDING_LIMITS.members).map((x) => {
        const o = obj(x);
        return { name: str(o.name, 120), role: str(o.role, 80), certificate: str(o.certificate, 120) };
      }),
    },
    areas: {
      districts: arr(a.districts, ONBOARDING_LIMITS.districts).map((d) => str(d, 60)).filter((d, i, all) => d !== "" && all.indexOf(d) === i),
      capacity: str(a.capacity, 6),
    },
    work: {
      installs: str(w.installs, 6),
      largest: str(w.largest, 8),
      summary: str(w.summary, 1500),
      projects: arr(w.projects, ONBOARDING_LIMITS.projects).map((x) => {
        const o = obj(x);
        return { title: str(o.title, 120), place: str(o.place, 120), size: str(o.size, 8), year: str(o.year, 4), note: str(o.note, 400) };
      }),
    },
  };
}

/** True for a yyyy-mm-dd that is a real date. */
export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export interface Gap {
  /** The section it belongs to, so the page can point at it. */
  section: "business" | "licences" | "areas" | "documents";
  text: string;
}

/**
 * What is still missing before an applicant may send their onboarding, in their words. Only what we truly need: a name for the business, where it is, the districts
 * it covers, and (for the kinds that hold a licence) a licence entry and a document for it, plus an identity document. The rest is welcome but optional.
 * `docKinds` is the kinds of the documents uploaded so far.
 */
export function onboardingGaps(partnerType: string | null, data: OnboardingData, docKinds: readonly string[]): Gap[] {
  const gaps: Gap[] = [];
  const person = partnerType === "technician";
  if (!data.business.name) gaps.push({ section: "business", text: person ? "Your name as on your certificate" : "Your business name" });
  if (!data.business.city) gaps.push({ section: "business", text: "The town or city you work from" });
  const needsLicence = partnerType === "contractor" || partnerType === "technician";
  if (needsLicence) {
    if (data.licences.length === 0) gaps.push({ section: "licences", text: "At least one licence or certificate" });
    for (const [i, l] of data.licences.entries()) {
      if (!l.type || !l.number) gaps.push({ section: "licences", text: `Licence ${i + 1}: the kind and the number` });
      if (l.validUntil && !isIsoDate(l.validUntil)) gaps.push({ section: "licences", text: `Licence ${i + 1}: a valid date` });
    }
    if (!docKinds.some((k) => k === "licence" || k === "certificate")) gaps.push({ section: "documents", text: "A copy of your licence or certificate" });
  }
  if (data.areas.districts.length === 0) gaps.push({ section: "areas", text: "At least one district you work in" });
  if (!docKinds.includes("identity")) gaps.push({ section: "documents", text: "An identity document for the person we deal with" });
  return gaps;
}
