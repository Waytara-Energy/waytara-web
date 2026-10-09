// The things a customer can put in a report of their own, grouped by category. Every parameter is a figure the report works out for
// each day (or each month, for longer periods and for the money ones) from the inverter's daily energy counters and the tariff.

export type ParamCategoryId = "solar" | "load" | "grid" | "battery" | "efficiency" | "environment" | "savings";
export type ParamUnit = "kWh" | "%" | "₹" | "kg";

export interface ReportParameter {
  id: string;
  category: ParamCategoryId;
  label: string;
  unit: ParamUnit;
  /** One line saying what it is, shown in the report builder. */
  description: string;
  /** Worked out per month only (a bill is a monthly thing), so a report using it is grouped by month. */
  monthlyOnly?: boolean;
}

export const PARAM_CATEGORIES: { id: ParamCategoryId; label: string }[] = [
  { id: "solar", label: "Solar" },
  { id: "load", label: "Load" },
  { id: "grid", label: "Grid" },
  { id: "battery", label: "Battery" },
  { id: "efficiency", label: "Self-use" },
  { id: "environment", label: "Environment" },
  { id: "savings", label: "Cost & savings" },
];

export const PARAMETERS: ReportParameter[] = [
  { id: "pv", category: "solar", label: "Solar generated", unit: "kWh", description: "Energy the panels made." },
  { id: "load", category: "load", label: "Energy used", unit: "kWh", description: "Energy the site used." },
  { id: "import", category: "grid", label: "Bought from the grid", unit: "kWh", description: "Energy taken from the grid." },
  { id: "export", category: "grid", label: "Sent to the grid", unit: "kWh", description: "Energy sent back to the grid." },
  { id: "net", category: "grid", label: "Net sent to the grid", unit: "kWh", description: "Sent minus bought (negative when you bought more)." },
  { id: "charged", category: "battery", label: "Battery charged", unit: "kWh", description: "Energy that went into the battery." },
  { id: "discharged", category: "battery", label: "Battery discharged", unit: "kWh", description: "Energy that came out of the battery." },
  { id: "selfUse", category: "efficiency", label: "Solar used on site", unit: "%", description: "Share of the solar energy used here, not sent to the grid." },
  { id: "covered", category: "efficiency", label: "Home covered by solar", unit: "%", description: "Share of what was used that did not come from the grid." },
  { id: "co2", category: "environment", label: "CO₂ avoided", unit: "kg", description: "Grid carbon the solar energy displaced." },
  { id: "billWithout", category: "savings", label: "Bill without solar", unit: "₹", description: "What everything used would have cost from the grid.", monthlyOnly: true },
  { id: "billWith", category: "savings", label: "Bill with solar", unit: "₹", description: "What is still paid after the solar.", monthlyOnly: true },
  { id: "saved", category: "savings", label: "Saved on the bill", unit: "₹", description: "The bill that the solar removed.", monthlyOnly: true },
];

export const PARAMETER_BY_ID: Record<string, ReportParameter> = Object.fromEntries(PARAMETERS.map((p) => [p.id, p]));

export const parametersOf = (category: ParamCategoryId): ReportParameter[] => PARAMETERS.filter((p) => p.category === category);
export const categoryLabel = (id: ParamCategoryId): string => PARAM_CATEGORIES.find((c) => c.id === id)?.label ?? id;
