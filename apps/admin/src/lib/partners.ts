// What the admin Partners pages share: the four review statuses, their labels, and how a service id reads to a person.

export const PARTNER_STATUSES = ["new", "in_review", "approved", "rejected"] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

export const PARTNER_STATUS_LABEL: Record<string, string> = {
  new: "New",
  in_review: "In review",
  approved: "Approved",
  rejected: "Rejected",
};

export const PARTNER_SERVICE_LABEL: Record<string, string> = {
  solar: "Solar installation",
  battery: "Battery storage",
  ev_charger: "EV charger installation",
  ems_integration: "Monitoring and integration",
  maintenance: "Operations and maintenance",
};

export function isPartnerStatus(value: string): value is PartnerStatus {
  return (PARTNER_STATUSES as readonly string[]).includes(value);
}
