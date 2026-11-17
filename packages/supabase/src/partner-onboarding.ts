// What a partner applicant tells us during onboarding, the documents each kind of partner must send, and the rules for the files. Pure (no framework, no database),
// shared by the website (which saves and checks it) and the admin app (which reads it), so the two always agree on the shape and on what is still missing.
//
// The documents asked of each kind of partner follow what Indian law and the Tamil Nadu rules ask of that kind of work (see documentRequirements). They were written
// from general knowledge of those rules and must be confirmed by WayTara's own compliance adviser before they are relied on.

export const DOCUMENT_KINDS = [
  // who they are
  { id: "identity", label: "Photo ID", hint: "PAN card, driving licence, voter ID, passport, or an Aadhaar copy with all but the last four digits hidden" },
  { id: "photo", label: "Photograph", hint: "A recent passport-size photo" },
  { id: "pan", label: "PAN card", hint: "The PAN the payments will be made against" },
  { id: "police_verification", label: "Police verification certificate", hint: "A police verification (character) certificate issued by the police, with its reference number and date" },
  { id: "driving_licence", label: "Driving licence", hint: "If you drive to sites for work" },
  { id: "kyc", label: "Other KYC proof", hint: "An address proof or another government document" },
  // the business
  { id: "gst_certificate", label: "GST registration certificate", hint: "The certificate from the GST portal (Form GST REG-06)" },
  { id: "registration", label: "Business registration", hint: "Certificate of incorporation, partnership deed or LLP agreement" },
  { id: "udyam", label: "Udyam (MSME) certificate", hint: "If you have registered on the Udyam portal" },
  { id: "address_proof", label: "Office address proof", hint: "A recent utility bill, property tax receipt or rent agreement for the address of the business" },
  { id: "authorisation_letter", label: "Authorisation letter or board resolution", hint: "A letter or resolution signed by the owners or directors that allows this person to act for the business" },
  { id: "shop_establishment", label: "Shops and Establishments registration", hint: "The Tamil Nadu registration of your office or shop, if you have one" },
  { id: "pf_esi", label: "EPF and ESI registration", hint: "Your employer registration, if it applies to the number of people you employ" },
  { id: "labour_licence", label: "Contract labour licence", hint: "If you engage enough workers through contractors to need one" },
  { id: "insurance", label: "Insurance", hint: "Employees' compensation (workmen's) cover, and liability cover if you have it" },
  // licences and certificates
  { id: "licence", label: "Electrical contractor licence", hint: "The licence from the Tamil Nadu Electrical Licensing Board, all pages" },
  { id: "contractor_tieup", label: "Licensed contractor tie-up", hint: "A letter or agreement from the licensed contractor your electrical work is done through, with a copy of their licence" },
  { id: "supervisor_permit", label: "Electrical supervisor permit", hint: "The competency certificate or permit of the licensed supervisor who works for you, with the permit number and validity" },
  { id: "certificate", label: "Competency certificate", hint: "Supervisor or wireman competency certificate" },
  { id: "trade_certificate", label: "Trade or education certificate", hint: "ITI or NCVT trade certificate, diploma or degree" },
  { id: "discom_registration", label: "Rooftop solar vendor registration", hint: "Your vendor registration on the national rooftop solar portal (PM Surya Ghar), approved by the distribution company" },
  { id: "training_certificate", label: "Training certificate", hint: "Suryamitra, a manufacturer's training, safety or first-aid training" },
  { id: "drone_certificate", label: "Drone pilot certificate", hint: "A remote pilot certificate, only if you fly a drone for surveys" },
  // bank
  { id: "bank_proof", label: "Bank proof", hint: "A cancelled cheque or the first page of the passbook, showing the name and the account number" },
  // past work
  { id: "work_photo", label: "Photos of your work", hint: "Finished installations" },
  { id: "survey_record", label: "Survey records", hint: "Site survey reports or measurements you have done" },
  { id: "completion_certificate", label: "Completion certificate or reference", hint: "A work completion certificate or a letter from a customer" },
  { id: "other", label: "Anything else", hint: "Another document you want us to see" },
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number]["id"];
export const DOCUMENT_KIND_IDS = DOCUMENT_KINDS.map((k) => k.id) as [DocumentKind, ...DocumentKind[]];
export const DOCUMENT_KIND_LABEL: Record<string, string> = Object.fromEntries(DOCUMENT_KINDS.map((k) => [k.id, k.label]));
export const DOCUMENT_KIND_HINT: Record<string, string> = Object.fromEntries(DOCUMENT_KINDS.map((k) => [k.id, k.hint]));
export const isDocumentKind = (v: unknown): v is DocumentKind => typeof v === "string" && (DOCUMENT_KIND_IDS as readonly string[]).includes(v);

/** The most one file may weigh (the bucket enforces the same number), and the most files one applicant may send. */
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_MAX_FILES = 80;

const TYPES: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** The kind of file a name says it is, or null when we do not take that kind. */
export function documentMime(fileName: string): string | null {
  const ext = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return ext ? (TYPES[ext] ?? null) : null;
}

/** What a file is, as a person reads it: "PDF", or "Image" with its format. Used for the label beside every file. */
export function fileTypeLabel(fileName: string): { type: "pdf" | "image" | "file"; label: string } {
  const ext = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  if (ext === "pdf") return { type: "pdf", label: "PDF" };
  if (ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "webp") return { type: "image", label: `Image · ${ext === "jpeg" ? "JPG" : ext.toUpperCase()}` };
  return { type: "file", label: ext ? ext.toUpperCase() : "File" };
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

/** The kinds of business that exist only through a registration document (a deed, an agreement or a certificate of incorporation). */
export const REGISTERED_BUSINESS_KINDS: readonly string[] = ["partnership", "llp", "company"];

export const LICENCE_TYPES = [
  { id: "contractor", label: "Electrical contractor licence" },
  { id: "supervisor", label: "Supervisor competency certificate" },
  { id: "wireman", label: "Wireman competency certificate" },
  { id: "trade", label: "ITI, NCVT, diploma or degree" },
  { id: "discom", label: "Rooftop solar vendor registration (PM Surya Ghar)" },
  { id: "empanelment", label: "Empanelment (for example with a distribution company or a government agency)" },
  { id: "training", label: "Training certificate (Suryamitra, manufacturer, safety)" },
  { id: "pvc", label: "Police verification certificate" },
  { id: "other", label: "Other licence or registration" },
] as const;

/** The kinds of licence that run out, so a "valid until" date is asked for (the others are lifelong, or show no date). */
export const LICENCE_EXPIRES: readonly string[] = ["contractor", "supervisor", "wireman", "discom", "empanelment"];

/** What the business does, and the test gear it owns: chosen from lists so the team can filter and match partners to jobs. */
export const CAPABILITIES = [
  { id: "lt_wiring", label: "LT wiring and panels" },
  { id: "ht_panels", label: "HT panels and substations" },
  { id: "on_grid_solar", label: "On-grid solar" },
  { id: "hybrid_bess", label: "Hybrid solar with battery storage" },
  { id: "ac_ev", label: "AC EV chargers" },
  { id: "dc_ev", label: "DC fast chargers" },
  { id: "earthing", label: "Earthing and lightning protection" },
  { id: "net_metering", label: "Net-metering paperwork with the distribution company" },
] as const;
export const EQUIPMENT = [
  { id: "clamp_meter", label: "Clamp meter" },
  { id: "megger", label: "Megger (insulation tester)" },
  { id: "earth_tester", label: "Earth resistance tester" },
  { id: "irradiance_meter", label: "Solar irradiance meter" },
  { id: "ocpp_kit", label: "Charger commissioning kit" },
] as const;

/** What a person on the team does on site. It decides the licence or certificate we ask them for. */
export const SITE_ROLES = [
  { id: "supervisor", label: "Licensed supervisor", needsLicence: true },
  { id: "wireman", label: "Lead electrician or wireman", needsLicence: true },
  { id: "solar_installer", label: "Solar installer", needsLicence: true },
  { id: "ev_engineer", label: "EV commissioning engineer", needsLicence: true },
  { id: "surveyor", label: "Site surveyor", needsLicence: true },
  { id: "helper", label: "Helper or other", needsLicence: false },
] as const;
export const siteRoleOf = (id: string) => SITE_ROLES.find((r) => r.id === id);

export const ACCOUNT_TYPES = [
  { id: "current", label: "Current" },
  { id: "savings", label: "Savings" },
] as const;

export interface PersonSection {
  /** The person we deal with, as their name is on their photo ID. */
  name: string;
  /** What they are in the business: owner, partner, director, manager. */
  designation: string;
  altPhone: string;
  /** Who we call if something happens on a site. */
  emergencyName: string;
  emergencyPhone: string;
  /** Whether they live at the address under Business details; when not, the current address follows. */
  currentSame: boolean;
  currentAddress: string;
  currentCity: string;
  currentPin: string;
}

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
  /** The PAN payments are made against: the business's, or the person's own for an individual or a proprietor. */
  pan: string;
  udyam: string;
  /** Ids from CAPABILITIES and EQUIPMENT. */
  capabilities: string[];
  equipment: string[];
}

export interface LicenceEntry {
  type: string;
  /** The class or grade, as printed on it. */
  grade: string;
  number: string;
  /** yyyy-mm-dd, the date it was issued */
  issuedOn: string;
  /** yyyy-mm-dd */
  validUntil: string;
}

export interface TeamMember {
  /** A stable id, given when the person is first saved; their documents and verification hang on it. Empty only for people saved before ids existed. */
  id: string;
  name: string;
  role: string;
  /** An id from SITE_ROLES: what they do on site, which decides what we ask of them. Empty for people saved before it existed. */
  siteRole: string;
  phone: string;
  email: string;
  certificate: string;
  /** yyyy-mm-dd: when the licence or certificate runs out. */
  validUntil: string;
  /** Whether this person needs a licence or certificate to do the work (default yes). Those who do must provide it and be verified. */
  needsLicence: boolean;
  /** When they were added (ISO). A person added after the partner was approved is verified before they count. */
  addedAt: string;
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

export interface BankSection {
  holder: string;
  bankName: string;
  branch: string;
  ifsc: string;
  accountType: string;
  accountNumber: string;
}

export interface OnboardingData {
  person: PersonSection;
  business: BusinessSection;
  licences: LicenceEntry[];
  team: TeamSection;
  areas: AreasSection;
  work: WorkSection;
  bank: BankSection;
}

/** A document as the partner sees it: what it is, whose it is and what it was called. Never where it is stored. */
export interface OnboardingDocument {
  id: string;
  kind: string;
  /** "partner", "member:<id>" (a team member) or "category:<id>" (a kind of past work). */
  subject: string;
  name: string;
  size: number;
  uploadedAt: string;
}

export const ONBOARDING_LIMITS = { licences: 10, members: 15, projects: 8, districts: 40 } as const;

export function emptyOnboarding(): OnboardingData {
  return {
    person: { name: "", designation: "", altPhone: "", emergencyName: "", emergencyPhone: "", currentSame: true, currentAddress: "", currentCity: "", currentPin: "" },
    business: { name: "", kind: "", started: "", address: "", city: "", pin: "", website: "", gstin: "", pan: "", udyam: "", capabilities: [], equipment: [] },
    licences: [],
    team: { size: "", certified: "", members: [] },
    areas: { districts: [], capacity: "" },
    work: { installs: "", largest: "", summary: "", projects: [] },
    bank: { holder: "", bankName: "", branch: "", ifsc: "", accountType: "", accountNumber: "" },
  };
}

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const arr = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
/** The ids of a list that are in the allowed set, once each, in the order of the set. */
const pick = (v: unknown, allowed: readonly { id: string }[]): string[] => (Array.isArray(v) ? allowed.filter((a) => v.includes(a.id)).map((a) => a.id) : []);
const upper = (v: unknown, max: number): string => str(v, max + 10).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, max);

/**
 * Turns whatever is stored (or sent) into a well-formed OnboardingData: unknown fields dropped, wrong types turned into empty text, long text cut, long lists cut.
 * It never throws, so an old or odd row still shows. Used on the way in (to save) and on the way out (to show).
 */
export function readOnboarding(raw: unknown): OnboardingData {
  const r = obj(raw);
  const p = obj(r.person);
  const b = obj(r.business);
  const t = obj(r.team);
  const a = obj(r.areas);
  const w = obj(r.work);
  const k = obj(r.bank);
  return {
    person: {
      name: str(p.name, 200),
      designation: str(p.designation, 80),
      altPhone: str(p.altPhone, 32),
      emergencyName: str(p.emergencyName, 120),
      emergencyPhone: str(p.emergencyPhone, 32),
      currentSame: p.currentSame !== false,
      currentAddress: str(p.currentAddress, 400),
      currentCity: str(p.currentCity, 100),
      currentPin: str(p.currentPin, 6),
    },
    business: {
      name: str(b.name, 200),
      kind: str(b.kind, 40),
      started: str(b.started, 4),
      address: str(b.address, 400),
      city: str(b.city, 100),
      pin: str(b.pin, 6),
      website: str(b.website, 300),
      gstin: upper(b.gstin, 15),
      pan: upper(b.pan, 10),
      udyam: str(b.udyam, 30).toUpperCase(),
      capabilities: pick(b.capabilities, CAPABILITIES),
      equipment: pick(b.equipment, EQUIPMENT),
    },
    licences: arr(r.licences, ONBOARDING_LIMITS.licences).map((x) => {
      const o = obj(x);
      return { type: str(o.type, 40), grade: str(o.grade, 60), number: str(o.number, 60), issuedOn: str(o.issuedOn, 10), validUntil: str(o.validUntil, 10) };
    }),
    team: {
      size: str(t.size, 6),
      certified: str(t.certified, 6),
      members: arr(t.members, ONBOARDING_LIMITS.members).map((x) => {
        const o = obj(x);
        const siteRole = siteRoleOf(str(o.siteRole, 30)) ? str(o.siteRole, 30) : "";
        return {
          id: str(o.id, 40).replace(/[^A-Za-z0-9_-]/g, ""),
          name: str(o.name, 120),
          role: str(o.role, 80),
          siteRole,
          phone: str(o.phone, 32),
          email: str(o.email, 200),
          certificate: str(o.certificate, 120),
          validUntil: str(o.validUntil, 10),
          needsLicence: o.needsLicence !== false,
          addedAt: str(o.addedAt, 30),
        };
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
    bank: {
      holder: str(k.holder, 200),
      bankName: str(k.bankName, 120),
      branch: str(k.branch, 120),
      ifsc: upper(k.ifsc, 11),
      accountType: str(k.accountType, 20),
      accountNumber: str(k.accountNumber, 24).replace(/\D/g, "").slice(0, 18),
    },
  };
}

/** True for a yyyy-mm-dd that is a real date. */
export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// The shapes the government numbers have. Checked so a typing slip is caught on the page; whether the number is real is what the team verifies.
export const isPan = (s: string): boolean => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(s);
export const isGstin = (s: string): boolean => /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(s);
export const isIfsc = (s: string): boolean => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(s);
export const isAccountNumber = (s: string): boolean => /^[0-9]{9,18}$/.test(s);
/** An account number with all but its last four digits hidden. */
export const maskAccount = (s: string): string => (s.length <= 4 ? s : `${"•".repeat(Math.max(4, s.length - 4))}${s.slice(-4)}`);

// ---- whose a document is ----

/** The key a team member's documents and checks are filed under: their id, or (for people saved before ids existed) their place in the list. */
export const memberKey = (m: { id: string }, index: number): string => m.id || `m${index}`;
export const memberSubject = (key: string): string => `member:${key}`;
export const categorySubject = (id: string): string => `category:${id}`;

/** The kinds of past work a partner can show photos or records of, by kind of partner. Each is a group of files of its own (subject category:<id>). */
export const WORK_CATEGORIES: Record<string, readonly { id: string; label: string; kind: DocumentKind }[]> = {
  contractor: [
    { id: "electrical", label: "Electrical installations and panels", kind: "work_photo" },
    { id: "solar", label: "Solar work", kind: "work_photo" },
    { id: "ev", label: "EV charger work", kind: "work_photo" },
  ],
  solar: [
    { id: "residential", label: "Residential rooftop", kind: "work_photo" },
    { id: "commercial", label: "Commercial and industrial", kind: "work_photo" },
    { id: "hybrid", label: "Hybrid and battery systems", kind: "work_photo" },
  ],
  ev: [
    { id: "ac_charger", label: "AC chargers", kind: "work_photo" },
    { id: "dc_charger", label: "DC chargers", kind: "work_photo" },
    { id: "electrical", label: "Electrical infrastructure", kind: "work_photo" },
  ],
  technician: [{ id: "work", label: "Work you have done", kind: "work_photo" }],
  survey: [
    { id: "survey", label: "Survey reports and measurements", kind: "survey_record" },
    { id: "site", label: "Site photos you have taken", kind: "work_photo" },
  ],
};
const DEFAULT_CATEGORIES = [{ id: "work", label: "Work you have done", kind: "work_photo" as DocumentKind }];
export const workCategories = (partnerType: string | null) => WORK_CATEGORIES[partnerType ?? ""] ?? DEFAULT_CATEGORIES;

/** What a team member can have filed under them. */
export const MEMBER_DOCUMENT_KINDS: readonly DocumentKind[] = ["identity", "certificate", "licence", "trade_certificate", "training_certificate", "police_verification", "driving_licence", "photo", "other"];
const WORK_DOCUMENT_KINDS: readonly DocumentKind[] = ["work_photo", "survey_record", "completion_certificate"];

/**
 * Why a file cannot be filed under a subject (in the partner's words), or null when it can. A team member's subject must be a person saved on this application, a
 * category must be one of this kind of partner's, and only the kinds that make sense for each are taken.
 */
export function documentSubjectProblem(partnerType: string | null, data: OnboardingData, subject: string, kind: string): string | null {
  if (!isDocumentKind(kind)) return "Please choose what the file is.";
  if (subject === "partner") return null;
  if (subject.startsWith("member:")) {
    const key = subject.slice(7);
    if (!data.team.members.some((m, i) => memberKey(m, i) === key)) return "Save this person first, then add their documents.";
    return MEMBER_DOCUMENT_KINDS.includes(kind) ? null : "That kind of document does not belong to a team member.";
  }
  if (subject.startsWith("category:")) {
    if (!workCategories(partnerType).some((c) => c.id === subject.slice(9))) return "Please choose the file again.";
    return WORK_DOCUMENT_KINDS.includes(kind) ? null : "Only photos, survey records and completion certificates go with past work.";
  }
  return "Please choose the file again.";
}

// ---- what each kind of partner must send ----

export type SectionId = "personal" | "business" | "licences" | "team" | "areas" | "work" | "bank";
export const SECTIONS: readonly { id: SectionId; label: string }[] = [
  { id: "personal", label: "Personal details" },
  { id: "business", label: "Business details" },
  { id: "licences", label: "Licences and certificates" },
  { id: "team", label: "Team" },
  { id: "areas", label: "Where you work" },
  { id: "work", label: "Past work and photos" },
  { id: "bank", label: "KYC and bank" },
];

/** required: must be there to send. conditional: must be there if it applies to them (the hint says when). optional: welcome. */
export type Need = "required" | "conditional" | "optional";
export const NEED_LABEL: Record<Need, string> = { required: "Required", conditional: "If it applies", optional: "Optional" };

export interface DocRequirement {
  kind: DocumentKind;
  section: SectionId;
  need: Need;
  label: string;
  /** What to send, in the partner's words. */
  hint: string;
  /** Why it is asked (the rule behind it), for the team that verifies it. */
  basis: string;
  /** A required document that any of these kinds satisfies (an own licence, or a tie-up with a licensed contractor). */
  anyOf?: readonly DocumentKind[];
}

const req = (kind: DocumentKind, section: SectionId, need: Need, basis: string, over?: Partial<Pick<DocRequirement, "label" | "hint" | "anyOf">>): DocRequirement => ({
  kind,
  section,
  need,
  basis,
  label: over?.label ?? DOCUMENT_KIND_LABEL[kind],
  hint: over?.hint ?? DOCUMENT_KIND_HINT[kind],
  ...(over?.anyOf ? { anyOf: over.anyOf } : {}),
});

const LICENSED_WORK = "Electrical installation work must be done by a State-licensed electrical contractor, under a person holding a competency certificate (CEA safety regulations; in Tamil Nadu the Electrical Licensing Board issues both).";
const PAYMENTS = "Needed to pay them and to deduct tax correctly: without a PAN, tax is deducted at a higher rate.";

/**
 * The documents a partner of this kind is asked for, in the order the pages show them, with why each is asked. What they entered decides a few: a GST number makes
 * the GST certificate required, and a partnership, LLP or company must send its registration.
 */
export function documentRequirements(partnerType: string | null, data: OnboardingData): DocRequirement[] {
  const individual = partnerType === "technician" || partnerType === "survey";
  const firm = REGISTERED_BUSINESS_KINDS.includes(data.business.kind);
  // a business with an office to prove: not someone working on their own, and not an individual who said so
  const hasOffice = !individual && data.business.kind !== "individual";
  const list: DocRequirement[] = [
    req("identity", "personal", "required", "To know who we are dealing with. Aadhaar is never demanded: any government photo ID is accepted, and an Aadhaar copy must be masked.", { label: individual ? "Your photo ID" : "Photo ID of the person we deal with" }),
    req("photo", "personal", "optional", "For the partner's profile and site passes."),
  ];
  if (individual) {
    list.push(
      req("police_verification", "personal", "required", "People who work alone in customers' homes and premises are asked for a police verification certificate, for the customers' safety.", { hint: "A police verification certificate with its reference number and date. If you do not have one yet, apply at your local police station or on the state police portal and send it when it arrives." }),
      req("driving_licence", "personal", "optional", "Shows they can travel to sites; for the team to plan assignments."),
    );
  }

  // the business
  if (data.business.gstin) list.push(req("gst_certificate", "business", "required", "They gave a GST number, so the certificate must match it. GST registration is compulsory above the turnover limit (Rs 20 lakh for services, Rs 40 lakh for goods)."));
  else if (!individual) list.push(req("gst_certificate", "business", "conditional", "GST registration is compulsory above the turnover limit (Rs 20 lakh for services, Rs 40 lakh for goods). Below it they may be unregistered.", { hint: "If you are registered for GST. Enter the number above and send the certificate." }));
  if (hasOffice) list.push(req("address_proof", "business", "required", "Shows where the business works from: the address on the registration and the contract must be one that exists."));
  if (firm) list.push(req("authorisation_letter", "business", "conditional", "A partnership, LLP or company is bound by its partners or directors: this shows the person we deal with may sign for it.", { hint: "If the person we deal with is not the only owner: a letter or board resolution that allows them to act for the business" }));
  if (firm) list.push(req("registration", "business", "required", "A partnership, LLP or company exists through this document; it shows who can sign for it."));
  else if (!individual) list.push(req("registration", "business", "optional", "Any registration in the business's name supports that it exists as described.", { hint: "Any registration in the business name, if you have one" }));
  if (!individual) {
    list.push(
      req("udyam", "business", "optional", "Shows MSME status (payment terms under the MSMED Act depend on it)."),
      req("shop_establishment", "business", "conditional", "The Tamil Nadu Shops and Establishments Act asks establishments with ten or more workers to register."),
      req("pf_esi", "business", "conditional", "EPF applies from 20 employees and ESI from 10. As the principal employer WayTara can be held liable for unpaid contributions of a contractor's workers."),
      req("labour_licence", "business", "conditional", "A contractor engaging 20 or more workers needs a licence under the Contract Labour Act."),
      req("insurance", "business", "conditional", "Employees' compensation cover protects workers hurt on site (Employees' Compensation Act) where ESI does not cover them.", { hint: "Employees' compensation (workmen's) cover if you employ people, and liability cover if you have it" }),
    );
  } else {
    list.push(req("insurance", "business", "optional", "Personal accident cover for someone working at height or with electricity.", { label: "Personal accident insurance", hint: "If you have it" }));
  }

  // licences and certificates, by kind of partner
  if (partnerType === "contractor") {
    list.push(req("licence", "licences", "required", LICENSED_WORK, { hint: "Your contractor licence from the Tamil Nadu Electrical Licensing Board, all pages, showing the grade and the validity" }));
    list.push(req("supervisor_permit", "licences", "required", "A licensed contractor must employ an electrical supervisor with a competency certificate; the permit number and validity show it is current."));
    list.push(req("training_certificate", "licences", "optional", "Supports the skills they claim."));
  } else if (partnerType === "solar" || partnerType === "ev") {
    list.push(req("licence", "licences", "required", LICENSED_WORK, { hint: "Your own contractor licence. If the electrical work is done through another licensed contractor, send the tie-up below instead.", anyOf: ["licence", "contractor_tieup"] }));
    list.push(req("contractor_tieup", "licences", "conditional", LICENSED_WORK, { hint: "Only if you do not hold a contractor licence yourself: a letter or agreement from the licensed contractor, with a copy of their licence" }));
    list.push(req("supervisor_permit", "licences", "required", LICENSED_WORK, { hint: "The permit of the licensed supervisor who works for you. If your electrical work is done through another contractor, their tie-up above covers this.", anyOf: ["supervisor_permit", "contractor_tieup"] }));
    if (partnerType === "solar") list.push(req("discom_registration", "licences", "conditional", "Only a vendor registered on the national portal and approved by the distribution company can install home systems under the PM Surya Ghar subsidy.", { hint: "If you install subsidised home systems: your vendor registration on the national rooftop solar portal" }));
    list.push(req("training_certificate", "licences", "optional", "Suryamitra or a manufacturer's training supports the skills they claim."));
  } else if (partnerType === "technician") {
    list.push(req("certificate", "licences", "required", "A person doing electrical work must hold a competency certificate or work under someone who does; a trade certificate shows the training behind it.", { label: "Competency or trade certificate", hint: "Your wireman or supervisor competency certificate. If you do not hold one, send your ITI, NCVT, diploma or degree certificate below.", anyOf: ["certificate", "trade_certificate"] }));
    list.push(req("trade_certificate", "licences", "conditional", "Shows their training where there is no competency certificate.", { hint: "ITI or NCVT trade certificate, diploma or degree" }));
    list.push(req("training_certificate", "licences", "optional", "Suryamitra or a manufacturer's training supports the skills they claim."));
  } else if (partnerType === "survey") {
    list.push(req("training_certificate", "licences", "optional", "No licence is needed for survey work; training supports the skills they claim."));
    list.push(req("drone_certificate", "licences", "conditional", "Flying a drone commercially needs a remote pilot certificate under the Drone Rules, except for the smallest drones."));
  }

  // KYC and bank
  list.push(
    req("pan", "bank", "required", PAYMENTS, { hint: individual || !firm ? "Your PAN card, or the business's if it has its own" : "The PAN card of the business" }),
    req("bank_proof", "bank", "required", "Shows the account belongs to the name we pay."),
    req("kyc", "bank", "optional", "An address proof, if the address is not on another document."),
  );
  return list;
}

/**
 * The documents asked for each person on the team: a photo ID always, then what their work on site needs (see SITE_ROLES): a supervisor's or wireman's permit, a solar
 * installer's training, an EV engineer's diploma or permit, a surveyor's qualification. A person saved before roles existed is asked as before: any licence or certificate.
 */
export function memberRequirements(needsLicence: boolean, siteRole = ""): { kind: DocumentKind; need: Need; label: string; hint: string; anyOf?: readonly DocumentKind[] }[] {
  const r = (kind: DocumentKind, need: Need, label: string, hint: string, anyOf?: readonly DocumentKind[]) => ({ kind, need, label, hint, ...(anyOf ? { anyOf } : {}) });
  const id = r("identity", "required", "Photo ID", DOCUMENT_KIND_HINT.identity);
  const training = r("training_certificate", "optional", "Training certificate", DOCUMENT_KIND_HINT.training_certificate);
  const police = r("police_verification", "optional", "Police verification certificate", DOCUMENT_KIND_HINT.police_verification);
  switch (siteRole) {
    case "supervisor":
      return [id, r("certificate", "required", "Supervisor competency certificate", "Their supervisor competency certificate or permit, showing the number and validity", ["certificate", "licence"]), police, training];
    case "wireman":
      return [id, r("certificate", "required", "Wireman permit", "Their wireman permit, showing the number and validity", ["certificate", "licence"]), r("trade_certificate", "optional", "ITI or diploma", "Their ITI or diploma certificate, if they have one"), police, training];
    case "solar_installer":
      return [id, r("trade_certificate", "required", "ITI or solar installer certificate", "Their ITI or a solar installer (Suryamitra or similar) certificate", ["trade_certificate", "certificate", "training_certificate"]), r("training_certificate", "optional", "Height safety training", "A certificate of working-at-height or safety training"), police];
    case "ev_engineer":
      return [id, r("certificate", "required", "Electrical diploma or wireman permit", "Their electrical diploma or wireman permit", ["certificate", "trade_certificate", "licence"]), r("training_certificate", "optional", "Charger maker's training", "A certificate from the charger manufacturer, if they have one"), police];
    case "surveyor":
      return [id, r("trade_certificate", "required", "Engineering or ITI qualification", "Their engineering degree, diploma or ITI certificate", ["trade_certificate", "certificate"]), r("driving_licence", "optional", "Driving licence", "If they drive to sites"), police];
    case "helper":
      return [id, police];
    default:
      return [
        id,
        ...(needsLicence ? [r("certificate", "required", "Licence or certificate", "Their competency certificate or licence", ["certificate", "licence", "trade_certificate"])] : []),
        training,
      ];
  }
}

export interface DocRef {
  kind: string;
  subject: string;
}

export interface Gap {
  /** The section it belongs to, so the page can point at it. */
  section: SectionId;
  text: string;
}

/**
 * What is still missing before a partner may send their onboarding, in their words. Everything the law or a payment needs: who they are and their photo ID, where the
 * business is, its registration where it has one, the licence or certificate of their kind of work, each team member's ID (and certificate where their work needs
 * one), the districts they cover, and the PAN and bank account with a proof of each. The rest is welcome but optional.
 */
export function onboardingGaps(partnerType: string | null, data: OnboardingData, docs: readonly DocRef[], now: Date = new Date()): Gap[] {
  const gaps: Gap[] = [];
  // today in India (yyyy-mm-dd): a licence is run out from the day after the date on it
  const today = new Date(now.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
  const add = (section: SectionId, text: string) => gaps.push({ section, text });
  const mine = docs.filter((d) => d.subject === "partner").map((d) => d.kind);
  const individual = partnerType === "technician" || partnerType === "survey";

  if (!data.person.name) add("personal", "Your name as on your photo ID");
  if (!data.person.emergencyName) add("personal", "The name of someone we can call in an emergency");
  if (data.person.emergencyPhone.replace(/\D/g, "").length < 10) add("personal", "Their phone number (10 digits)");
  if (!data.person.currentSame) {
    if (!data.person.currentAddress) add("personal", "Your current address");
    if (!data.person.currentCity) add("personal", "The town or city of your current address");
    if (!/^[1-9][0-9]{5}$/.test(data.person.currentPin)) add("personal", "The PIN code of your current address (six digits)");
  }

  if (!data.business.name) add("business", individual ? "The name you work under" : "Your business name");
  if (!individual && !data.business.kind) add("business", "The kind of business");
  if (!data.business.address) add("business", "Your address");
  if (!data.business.city) add("business", "The town or city you work from");
  if (!/^[1-9][0-9]{5}$/.test(data.business.pin)) add("business", "The PIN code (six digits)");
  if (data.business.gstin && !isGstin(data.business.gstin)) add("business", "The GST number does not look right (15 characters)");
  if (!individual && data.business.capabilities.length === 0) add("business", "At least one thing your business does");

  const needsLicence = partnerType === "contractor" || partnerType === "technician";
  if (needsLicence && data.licences.filter((l) => l.type !== "pvc").length === 0) add("licences", "At least one licence or certificate, with its number");
  for (const [i, l] of data.licences.entries()) {
    if (!l.type || !l.number) add("licences", `Licence ${i + 1}: the kind and the number`);
    if (l.validUntil && !isIsoDate(l.validUntil)) add("licences", `Licence ${i + 1}: a valid date`);
    else if (!l.validUntil && LICENCE_EXPIRES.includes(l.type)) add("licences", `Licence ${i + 1}: the date it is valid until`);
    else if (l.validUntil && l.validUntil < today) add("licences", `Licence ${i + 1}: it ran out on ${l.validUntil}. Send the renewed one, or its receipt if the renewal is under way`);
    if (l.issuedOn && !isIsoDate(l.issuedOn)) add("licences", `Licence ${i + 1}: a valid date of issue`);
    else if (l.type === "pvc" && !l.issuedOn) add("licences", `Licence ${i + 1}: the date it was issued`);
  }
  // what each kind of work must list, beyond the copies: a contractor's supervisor, and the police verification of someone who works alone
  if (partnerType === "contractor" && !data.licences.some((l) => l.type === "supervisor")) add("licences", "Your supervisor's permit, with its number and validity");
  if (individual && !data.licences.some((l) => l.type === "pvc")) add("licences", "Your police verification certificate, with its reference number and date");

  for (const [i, m] of data.team.members.entries()) {
    const who = m.name || `Person ${i + 1}`;
    const theirs = docs.filter((d) => d.subject === memberSubject(memberKey(m, i))).map((d) => d.kind);
    if (!m.name) add("team", `Person ${i + 1}: their name`);
    if (m.needsLicence && !m.certificate) add("team", `${who}: the licence or certificate number`);
    if ((m.siteRole === "supervisor" || m.siteRole === "wireman") && !m.validUntil) add("team", `${who}: the date their permit is valid until`);
    if (m.needsLicence && m.validUntil && !isIsoDate(m.validUntil)) add("team", `${who}: a valid date for when it runs out`);
    else if (m.needsLicence && m.validUntil && m.validUntil < today) add("team", `${who}: the licence or certificate ran out on ${m.validUntil}. Send the renewed one`);
    for (const r of memberRequirements(m.needsLicence, m.siteRole)) {
      if (r.need === "required" && !(r.anyOf ?? [r.kind]).some((k) => theirs.includes(k))) add("team", `${who}: ${r.kind === "identity" ? "a photo ID" : "a copy of the licence or certificate"}`);
    }
  }

  if (data.areas.districts.length === 0) add("areas", "At least one district you work in");

  if (!isPan(data.business.pan)) add("bank", data.business.pan ? "The PAN does not look right (10 characters, like ABCDE1234F)" : "Your PAN");
  if (!data.bank.holder) add("bank", "The name on the bank account");
  if (!data.bank.bankName) add("bank", "The bank's name");
  if (!isIfsc(data.bank.ifsc)) add("bank", data.bank.ifsc ? "The IFSC does not look right (11 characters, like SBIN0001234)" : "The IFSC of the branch");
  if (!isAccountNumber(data.bank.accountNumber)) add("bank", "The account number (9 to 18 digits)");

  for (const r of documentRequirements(partnerType, data)) {
    if (r.need === "required" && !(r.anyOf ?? [r.kind]).some((k) => mine.includes(k))) add(r.section, `A copy of: ${r.label.toLowerCase().startsWith("your ") ? r.label.slice(5) : r.label}`);
  }
  // in the order of the pages
  const order = SECTIONS.map((s) => s.id);
  return gaps.sort((a, b) => order.indexOf(a.section) - order.indexOf(b.section));
}

/**
 * Gives every team member an id and a date added, if they have none. Called where a partner's answers are SAVED (never when they are read), so an id never changes once
 * it exists and the documents and checks filed under it stay theirs.
 */
export function ensureMemberIds(data: OnboardingData, now: Date = new Date()): OnboardingData {
  return { ...data, team: { ...data.team, members: data.team.members.map((m) => ({ ...m, id: m.id || crypto.randomUUID(), addedAt: m.addedAt || now.toISOString() })) } };
}
