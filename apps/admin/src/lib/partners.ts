// What the admin Partners pages share: the review stages, their labels, the kinds of partner, and how a service id reads to a person.

// The stages of an application, in order: new, a screening call (in review), shortlisted (an onboarding invitation goes out), detailed onboarding, verification,
// then approved or rejected.
export const PARTNER_STATUSES = ["new", "in_review", "shortlisted", "onboarding", "verification", "approved", "rejected"] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

export const PARTNER_STATUS_LABEL: Record<string, string> = {
  new: "New",
  in_review: "Screening",
  shortlisted: "Shortlisted",
  onboarding: "Onboarding",
  verification: "Verification",
  approved: "Approved",
  rejected: "Rejected",
};

/** The four kinds of partner of the public Partner Network page (an application made before it has none). */
export const PARTNER_TYPE_LABEL: Record<string, string> = {
  contractor: "Electrical contractor",
  solar: "Solar installation partner",
  ev: "EV charging partner",
  technician: "Field technician",
};

export const PARTNER_SERVICE_LABEL: Record<string, string> = {
  // the Partner Network form
  electrical_contracting: "Electrical contracting",
  solar_epc: "Solar EPC",
  industrial_electrical: "Industrial electrical",
  ev_charging: "EV charging",
  residential_rooftop: "Residential rooftop",
  commercial_rooftop: "Commercial rooftop",
  industrial_solar: "Industrial solar",
  hybrid_systems: "Hybrid systems",
  ac_charger: "AC charger installation",
  dc_charger: "DC charger installation",
  commissioning: "Charger commissioning",
  ev_electrical: "EV electrical infrastructure",
  ocpp_cms: "OCPP / CMS integration",
  ev_maintenance: "Maintenance and service",
  electrician: "Electrician",
  solar_technician: "Solar technician",
  inverter_battery_technician: "Inverter or battery technician",
  ev_technician: "EV charger technician",
  electronics_technician: "Electronics technician",
  other_trade: "Other trade",
  // the form that came before it
  solar: "Solar installation",
  battery: "Battery storage",
  ev_charger: "EV charger installation",
  ems_integration: "Monitoring and integration",
  maintenance: "Operations and maintenance",
};

export function isPartnerStatus(value: string): value is PartnerStatus {
  return (PARTNER_STATUSES as readonly string[]).includes(value);
}

/** The answers stored with an application ([{ q, a }]); anything else in the column reads as no answers. */
export function readAnswers(value: unknown): { q: string; a: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((x) => (x && typeof x === "object" && typeof (x as { q?: unknown }).q === "string" && typeof (x as { a?: unknown }).a === "string" ? [{ q: (x as { q: string }).q, a: (x as { a: string }).a }] : []));
}
