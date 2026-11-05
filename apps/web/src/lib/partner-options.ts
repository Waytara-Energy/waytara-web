// The choices on the partner application form. Shared by the form and the API route so the two can never disagree.

export const PARTNER_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

export const PARTNER_SERVICES = [
  { id: "solar", label: "Solar installation" },
  { id: "battery", label: "Battery storage" },
  { id: "ev_charger", label: "EV charger installation" },
  { id: "ems_integration", label: "Monitoring and integration" },
  { id: "maintenance", label: "Operations and maintenance" },
] as const;

export const PARTNER_INSTALL_RANGES = ["Just starting", "Fewer than 25", "25 to 100", "100 to 500", "More than 500"] as const;
export const PARTNER_TEAM_SIZES = ["Just me", "2 to 5", "6 to 20", "21 to 50", "More than 50"] as const;

export type PartnerServiceId = (typeof PARTNER_SERVICES)[number]["id"];

export const PARTNER_SERVICE_LABEL: Record<string, string> = Object.fromEntries(PARTNER_SERVICES.map((s) => [s.id, s.label]));
