// What the applicant already told us when they applied, offered as the starting point of their onboarding so they never type the same thing twice: the kind of
// business, its name, their role and the districts. Pure, so it is tested. Used only while nothing of the onboarding has been saved yet.

import { BUSINESS_KINDS, type OnboardingData } from "@waytara/supabase/partner-onboarding";
import { PARTNER_QUESTIONS, TN_DISTRICTS, isPartnerType } from "./partner-network";

export interface SeedSource {
  partnerType: string | null;
  contactName: string;
  companyName: string;
  /** "Chennai" or "Chennai; also Madurai, Salem", as the application stores it. */
  cities: string;
  /** The questions and answers as people read them. */
  answers: { q: string; a: string }[];
}

/** The stored questions and answers (a JSON list) as a clean list; anything that is not a question with an answer is dropped. */
export function readAnswers(value: unknown): { q: string; a: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((x) => (x && typeof x === "object" && typeof (x as { q?: unknown }).q === "string" && typeof (x as { a?: unknown }).a === "string" ? [{ q: (x as { q: string }).q, a: (x as { a: string }).a }] : []));
}

/** The apply form's kind of business to the onboarding's. */
const ENTITY_TO_KIND: Record<string, string> = { individual: "individual", proprietorship: "proprietorship", partnership: "partnership", llp: "llp", private_limited: "company" };

/** The answer someone gave to one of the apply form's questions, as the id of the choice (or null when it was not asked or answered). */
function chosen(src: SeedSource, key: string): string | null {
  if (!isPartnerType(src.partnerType)) return null;
  const q = PARTNER_QUESTIONS[src.partnerType].find((x) => x.key === key);
  const a = q && src.answers.find((x) => x.q === q.label)?.a;
  return a ? (q.options?.find((o) => o.label === a)?.id ?? null) : null;
}

/** Fills what is empty from the application. Never overwrites anything already there. */
export function seedOnboarding(data: OnboardingData, src: SeedSource): OnboardingData {
  const next: OnboardingData = { ...data, person: { ...data.person }, business: { ...data.business }, areas: { ...data.areas } };
  if (!next.person.name) next.person.name = src.contactName;

  const individualKind = src.partnerType === "technician" || src.partnerType === "survey";
  const entity = chosen(src, "entity");
  const kind = entity ? ENTITY_TO_KIND[entity] : null;
  if (!next.business.kind && kind && BUSINESS_KINDS.some((k) => k.id === kind)) next.business.kind = kind;
  // a technician or survey associate has no company: the person's own name stands in for it, so it is not a business name worth offering
  if (!next.business.name && !individualKind && src.companyName && src.companyName !== src.contactName) next.business.name = src.companyName;

  if (!next.person.designation && !individualKind) {
    const role = src.answers.find((x) => x.q === PARTNER_QUESTIONS.contractor.find((q) => q.key === "role")?.label)?.a;
    if (role) next.person.designation = role;
  }

  if (next.areas.districts.length === 0) {
    const [main, rest = ""] = src.cities.split(";");
    const places = [main, ...rest.replace(/^\s*also\s+/i, "").split(",")].map((s) => s.trim());
    next.areas.districts = places.filter((d, i, all) => TN_DISTRICTS.includes(d) && all.indexOf(d) === i);
  }
  return next;
}
