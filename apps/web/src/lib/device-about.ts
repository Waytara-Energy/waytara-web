// The "about" pages of the Devices screen: one per piece of equipment (the inverter, the solar panels, the battery ...), laid out like the
// About screen of a phone - who made it, what it can do, what software it runs, how long it is covered. Pure, so it is tested.
import type { CustomerDevice } from "./device-display";
import type { FieldValue } from "./template-field-format";

export type AboutKind = "inverter" | "charger" | "panel" | "battery" | "other";

export type AboutRow = [label: string, value: string | null | undefined];

export interface AboutSectionData {
  title: string;
  rows: AboutRow[];
}

export interface AboutBadge {
  label: string;
  tone: "good" | "warn" | "neutral";
}

export interface AboutPageData {
  id: string;
  /** The name in the menu. */
  menuLabel: string;
  kind: AboutKind;
  /** The big name at the top of the page, and the line under it. */
  title: string;
  subtitle: string | null;
  badges: AboutBadge[];
  /** How long the cover lasts, in a few words ("4 years 4 months left"), for the headline. */
  coverShort: string | null;
  sections: AboutSectionData[];
}

/** A part installed under the device (the solar panels, the battery), as the page needs it. */
export interface ChildView {
  id: string;
  label: string | null;
  quantity: number;
  installedAt: string | null;
  warrantyEndDate: string | null;
  category: string | null;
  name: string | null;
  manufacturer: string | null;
  brand: string | null;
  model: string | null;
  modelNumber: string | null;
  serialNumber: string | null;
  powerValue: number | string | null;
  powerUnit: string | null;
  specs: Record<string, unknown> | null;
}

/** The readings the inverter reports about itself that this page uses (equipment_latest keys). */
export const ABOUT_READING_KEYS = [
  "serial_number",
  "rated_power_w",
  "mppt_count",
  "phase_count",
  "control_board_firmware_version",
  "communication_board_firmware_version",
  "battery_firmware_version",
] as const;

// What a stored spec is called to a customer, the unit to add when the value is a bare number, and the block it sits in.
const SPEC: Record<string, { label: string; unit?: string; block: string }> = {
  ip_rating: { label: "Protection rating", block: "Power and inputs" },
  max_pv_input_kw: { label: "Largest solar input", unit: "kW", block: "Power and inputs" },
  mppt_count: { label: "Solar inputs (MPPT)", block: "Power and inputs" },
  phase: { label: "Phases", block: "Power and inputs" },
  cell_type: { label: "Cell type", block: "Panel" },
  cells: { label: "Cells", block: "Panel" },
  bifaciality: { label: "Bifaciality", block: "Panel" },
  efficiency_pct: { label: "Efficiency", unit: "%", block: "Electrical" },
  isc_a: { label: "Short-circuit current", unit: "A", block: "Electrical" },
  voc_v: { label: "Open-circuit voltage", unit: "V", block: "Electrical" },
  chemistry: { label: "Chemistry", block: "Capacity and life" },
  usable_kwh: { label: "Usable energy", unit: "kWh", block: "Capacity and life" },
  nominal_voltage: { label: "Nominal voltage", unit: "V", block: "Capacity and life" },
  dod: { label: "Depth of discharge", block: "Capacity and life" },
  eol_pct: { label: "Capacity at end of life", unit: "%", block: "Capacity and life" },
};

const prettify = (key: string) => key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

const isBareNumber = (v: unknown) => (typeof v === "number" && Number.isFinite(v)) || (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)));

function specRow(key: string, value: unknown): AboutRow {
  const meta = SPEC[key];
  const text = String(value);
  return [meta?.label ?? prettify(key), meta?.unit && isBareNumber(value) ? `${text} ${meta.unit}` : text];
}

/** The specs left in `used`'s complement, as rows in the block they belong to (blocks the caller lists first keep their order). */
function specsIn(specs: Record<string, unknown> | null, block: string): AboutRow[] {
  const rows: AboutRow[] = [];
  for (const [key, value] of Object.entries(specs ?? {})) {
    if (value === null || value === undefined || typeof value === "object" || value === "") continue;
    if ((SPEC[key]?.block ?? "More details") === block) rows.push(specRow(key, value));
  }
  return rows;
}

const blocksOf = (specs: Record<string, unknown> | null) => Array.from(new Set(Object.keys(specs ?? {}).map((k) => SPEC[k]?.block ?? "More details")));

/** A reading as text: "2.0" is 2, an empty or zero reading is nothing. */
export function readingText(v: FieldValue | undefined, unit?: string): string | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (Number.isFinite(n)) {
    if (n === 0) return null;
    return unit ? `${n.toLocaleString("en-IN")} ${unit}` : String(n);
  }
  return String(v).trim() || null;
}

export const fmtDate = (v: string | null | undefined): string | null => (v ? new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null);

/** How long cover lasts, as a badge and a line: "Until 12 Mar 2030 (3 years 5 months left)". */
export function warranty(endIso: string | null, now = new Date()): { line: string | null; short: string | null; badge: AboutBadge | null } {
  if (!endIso) return { line: null, short: null, badge: null };
  const end = new Date(endIso);
  if (Number.isNaN(end.getTime())) return { line: null, short: null, badge: null };
  const date = fmtDate(endIso);
  if (end < now) return { line: `Ended ${date}`, short: "Ended", badge: { label: "Warranty ended", tone: "warn" } };
  let months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
  if (end.getDate() < now.getDate()) months -= 1;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const left = [years > 0 ? `${years} ${years === 1 ? "year" : "years"}` : null, rest > 0 ? `${rest} ${rest === 1 ? "month" : "months"}` : null].filter(Boolean).join(" ");
  return { line: `Until ${date}${left ? ` (${left} left)` : " (ends this month)"}`, short: left ? `${left} left` : "Ends this month", badge: { label: "In warranty", tone: "good" } };
}

const CATEGORY_TITLE: Record<string, string> = { "Solar Panels": "Solar panels", Batteries: "Battery" };

function kindOfCategory(category: string | null): AboutKind {
  if (category === "Solar Panels") return "panel";
  if (category === "Batteries") return "battery";
  return "other";
}

const unique = (values: (string | null | undefined)[]) => values.filter((v, i, a): v is string => !!v && a.indexOf(v) === i);

/** The power package the site was set up with (set by WayTara staff): its name and what it includes. */
export interface PowerPackageView {
  label: string;
  includes: string[];
}

/** The page for the device itself (the inverter or charger). `readings` are the values the device reports about itself. */
export function inverterAbout(device: CustomerDevice, ownSpecs: Record<string, unknown> | null, ownPower: { value: number | string | null; unit: string | null }, readings: Map<string, FieldValue>, now = new Date(), powerPackage: PowerPackageView | null = null): AboutPageData {
  const t = device.deviceType;
  const kind: AboutKind = t?.category === "ev_charger" ? "charger" : t?.category === "solar_inverter" ? "inverter" : "other";
  const cover = warranty(device.warrantyEndDate, now);
  const rated = readingText(readings.get("rated_power_w"), "W") ?? (isBareNumber(ownPower.value) && Number(ownPower.value) > 0 ? `${Number(ownPower.value)} ${ownPower.unit ?? "kW"}` : null);
  const power = specsIn(ownSpecs, "Power and inputs");
  const have = (label: string) => power.some(([l]) => l === label);
  const extra: AboutRow[] = [];
  const mppt = readingText(readings.get("mppt_count"));
  if (mppt && !have("Solar inputs (MPPT)")) extra.push(["Solar inputs (MPPT)", mppt]);
  const phases = readingText(readings.get("phase_count"));
  if (phases && !have("Phases")) extra.push(["Phases", phases]);

  const sections: AboutSectionData[] = [
    {
      title: "About",
      rows: [
        ["Device name", device.label],
        ["Model", t ? unique([t.name, t.model]).join(" · ") || null : null],
        ["Model number", t?.modelNumber],
        ["Serial number", t?.serialNumber ?? readingText(readings.get("serial_number"))],
        ["Maker", t?.brand ?? t?.manufacturer],
        ["Installed", fmtDate(device.installedAt)],
        ["Warranty", cover.line],
      ],
    },
    { title: kind === "charger" ? "Power" : "Power and inputs", rows: [["Rated power", rated], ...power, ...extra] },
    { title: "Power package", rows: powerPackage ? [["Package", powerPackage.label], ["Includes", powerPackage.includes.join(", ") || null]] : [] },
    {
      title: "Software",
      rows: [
        ["Control board", readingText(readings.get("control_board_firmware_version"))],
        ["Communication board", readingText(readings.get("communication_board_firmware_version"))],
        ["Battery", readingText(readings.get("battery_firmware_version"))],
      ],
    },
  ];
  for (const block of blocksOf(ownSpecs)) if (block !== "Power and inputs") sections.push({ title: block, rows: specsIn(ownSpecs, block) });

  return {
    id: "device",
    menuLabel: kind === "charger" ? "Charger" : kind === "inverter" ? "Inverter" : "Device",
    kind,
    title: device.label || t?.name || "Device",
    subtitle: t ? unique([t.brand ?? t.manufacturer, t.model]).join(" · ") || null : null,
    badges: cover.badge ? [cover.badge] : [],
    coverShort: cover.short,
    sections,
  };
}

/** The page for one part installed under the device. */
export function partAbout(c: ChildView, duplicateCategory: boolean, now = new Date()): AboutPageData {
  const kind = kindOfCategory(c.category);
  const base = CATEGORY_TITLE[c.category ?? ""] ?? c.category ?? "Equipment";
  const perUnit = c.powerValue !== null && c.powerValue !== "" ? Number(c.powerValue) : null;
  const unit = (c.powerUnit ?? "W").toLowerCase();
  const watts = perUnit !== null && Number.isFinite(perUnit) ? (unit === "kw" || unit === "kwp" ? perUnit * 1000 : unit === "w" || unit === "wp" ? perUnit : null) : null;
  const cover = warranty(c.warrantyEndDate, now);

  const sections: AboutSectionData[] = [
    {
      title: "About",
      rows: [
        ["Model", unique([c.name, c.model]).join(" · ") || null],
        ["Model number", c.modelNumber],
        ["Serial number", c.serialNumber],
        ["Maker", c.brand ?? c.manufacturer],
        ["Installed", fmtDate(c.installedAt)],
        ["Warranty", cover.line],
      ],
    },
  ];
  if (kind === "panel") {
    sections.push({
      title: "Array",
      rows: [
        ["Panels", String(c.quantity)],
        ["Power of each panel", watts !== null ? `${Math.round(watts)} W` : null],
        ["Together", watts !== null ? `${((watts * Math.max(1, c.quantity)) / 1000).toFixed(2)} kWp` : null],
      ],
    });
  } else if (kind === "battery") {
    const cap = perUnit !== null && Number.isFinite(perUnit) && perUnit > 0 ? `${perUnit} ${c.powerUnit ?? ""}`.trim() : null;
    sections.push({ title: "Capacity and life", rows: [["Capacity", cap], ["Units", c.quantity > 1 ? String(c.quantity) : null], ...specsIn(c.specs, "Capacity and life")] });
  } else if (c.quantity > 1) {
    sections.push({ title: "Quantity", rows: [["Units", String(c.quantity)]] });
  }
  for (const block of blocksOf(c.specs)) if (!(kind === "battery" && block === "Capacity and life")) sections.push({ title: block, rows: specsIn(c.specs, block) });

  return {
    id: `part-${c.id}`,
    menuLabel: duplicateCategory && c.label ? `${base} · ${c.label}` : base,
    kind,
    title: c.label && c.label !== c.name ? c.label : base,
    subtitle: unique([c.brand ?? c.manufacturer, c.model ?? c.name]).join(" · ") || null,
    badges: cover.badge ? [cover.badge] : [],
    coverShort: cover.short,
    sections,
  };
}

/** Every about page of a device: itself first, then its parts. */
export function aboutPages(device: CustomerDevice, ownSpecs: Record<string, unknown> | null, ownPower: { value: number | string | null; unit: string | null }, readings: Map<string, FieldValue>, parts: ChildView[], now = new Date(), powerPackage: PowerPackageView | null = null): AboutPageData[] {
  const categories = parts.map((p) => p.category);
  return [inverterAbout(device, ownSpecs, ownPower, readings, now, powerPackage), ...parts.map((p) => partAbout(p, categories.filter((c) => c === p.category).length > 1, now))];
}
