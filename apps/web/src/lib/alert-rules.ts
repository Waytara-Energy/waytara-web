// Customer alerts: "tell me when the battery is below 20%". What can be watched (the metrics), the ready-made alerts WayTara switches on or
// offers, how a customer's own rows change or add to them, and when a rule fires. Pure, so the rules are tested; the job that reads the
// readings and sends the notices is /api/cron/evaluate-alert-rules.

export type MetricGroup = "Battery" | "Solar" | "Grid" | "Consumption" | "Rate & cost";

export interface Metric {
  id: string;
  label: string;
  group: MetricGroup;
  /** the unit the limit is written in (and the value is shown in) */
  unit: string;
  /** the smallest change that counts when deciding a value has moved back from its limit */
  step: number;
  /** a sensible starting limit and direction when a customer adds an alert on it */
  starter: { op: Op; threshold: number };
}

export type Op = "above" | "below";

export const METRICS: Metric[] = [
  { id: "battery_soc", label: "Battery level", group: "Battery", unit: "%", step: 1, starter: { op: "below", threshold: 20 } },
  { id: "battery_charge_kw", label: "Battery charging power", group: "Battery", unit: "kW", step: 0.1, starter: { op: "above", threshold: 3 } },
  { id: "battery_discharge_kw", label: "Battery discharging power", group: "Battery", unit: "kW", step: 0.1, starter: { op: "above", threshold: 3 } },
  { id: "battery_temp_c", label: "Battery temperature", group: "Battery", unit: "°C", step: 1, starter: { op: "above", threshold: 45 } },
  { id: "solar_kw", label: "Solar power", group: "Solar", unit: "kW", step: 0.1, starter: { op: "above", threshold: 4 } },
  { id: "solar_today_kwh", label: "Solar energy today", group: "Solar", unit: "kWh", step: 0.5, starter: { op: "above", threshold: 30 } },
  { id: "grid_import_kw", label: "Grid import power", group: "Grid", unit: "kW", step: 0.1, starter: { op: "above", threshold: 5 } },
  { id: "grid_export_kw", label: "Grid export power", group: "Grid", unit: "kW", step: 0.1, starter: { op: "above", threshold: 5 } },
  { id: "import_today_kwh", label: "Energy bought today", group: "Grid", unit: "kWh", step: 0.5, starter: { op: "above", threshold: 15 } },
  { id: "export_today_kwh", label: "Energy sent to the grid today", group: "Grid", unit: "kWh", step: 0.5, starter: { op: "above", threshold: 10 } },
  { id: "load_kw", label: "Consumption power", group: "Consumption", unit: "kW", step: 0.1, starter: { op: "above", threshold: 8 } },
  { id: "load_today_kwh", label: "Energy used today", group: "Consumption", unit: "kWh", step: 0.5, starter: { op: "above", threshold: 30 } },
  { id: "tariff_rate", label: "Electricity rate", group: "Rate & cost", unit: "₹/kWh", step: 0.05, starter: { op: "above", threshold: 12 } },
  { id: "import_cost_today", label: "Grid cost today", group: "Rate & cost", unit: "₹", step: 1, starter: { op: "above", threshold: 150 } },
  { id: "solar_value_today", label: "Value of the solar energy today (estimate)", group: "Rate & cost", unit: "₹", step: 1, starter: { op: "above", threshold: 300 } },
];

const BY_ID = new Map(METRICS.map((m) => [m.id, m]));
export const metricOf = (id: string): Metric | null => BY_ID.get(id) ?? null;
export const METRIC_GROUPS: MetricGroup[] = ["Battery", "Solar", "Grid", "Consumption", "Rate & cost"];

export type Severity = "info" | "warning" | "critical";

export interface Preset {
  id: string;
  metric: string;
  op: Op;
  threshold: number;
  severity: Severity;
  cooldownMinutes: number;
  /** switched on for everyone until they turn it off */
  defaultOn: boolean;
  hint: string;
}

/** The ready-made alerts. Those with `defaultOn` are active for every customer from the start. */
export const PRESETS: Preset[] = [
  { id: "battery_low", metric: "battery_soc", op: "below", threshold: 20, severity: "warning", cooldownMinutes: 180, defaultOn: true, hint: "A heads-up before the battery runs low." },
  { id: "battery_critical", metric: "battery_soc", op: "below", threshold: 10, severity: "critical", cooldownMinutes: 180, defaultOn: true, hint: "The battery is nearly empty." },
  { id: "battery_full", metric: "battery_soc", op: "above", threshold: 99, severity: "info", cooldownMinutes: 720, defaultOn: false, hint: "The battery is full." },
  { id: "grid_import_high", metric: "grid_import_kw", op: "above", threshold: 5, severity: "warning", cooldownMinutes: 120, defaultOn: true, hint: "You are buying a lot of power from the grid right now." },
  { id: "export_high", metric: "grid_export_kw", op: "above", threshold: 5, severity: "info", cooldownMinutes: 240, defaultOn: false, hint: "You are sending a lot of power to the grid." },
  { id: "load_high", metric: "load_kw", op: "above", threshold: 8, severity: "warning", cooldownMinutes: 120, defaultOn: false, hint: "Your site is using a lot of power." },
  { id: "solar_good_day", metric: "solar_today_kwh", op: "above", threshold: 30, severity: "info", cooldownMinutes: 1440, defaultOn: false, hint: "A very good day for solar." },
  { id: "import_day_high", metric: "import_today_kwh", op: "above", threshold: 15, severity: "warning", cooldownMinutes: 1440, defaultOn: true, hint: "You have bought a lot of energy today." },
  { id: "export_day", metric: "export_today_kwh", op: "above", threshold: 10, severity: "info", cooldownMinutes: 1440, defaultOn: false, hint: "You have sent a lot of energy to the grid today." },
  { id: "load_day_high", metric: "load_today_kwh", op: "above", threshold: 30, severity: "warning", cooldownMinutes: 1440, defaultOn: false, hint: "You have used a lot of energy today." },
  { id: "cost_day_high", metric: "import_cost_today", op: "above", threshold: 150, severity: "warning", cooldownMinutes: 1440, defaultOn: true, hint: "What you owe the grid today is getting high." },
  { id: "rate_high", metric: "tariff_rate", op: "above", threshold: 12, severity: "info", cooldownMinutes: 1440, defaultOn: false, hint: "The electricity rate is above your limit." },
  { id: "solar_value_day", metric: "solar_value_today", op: "above", threshold: 300, severity: "info", cooldownMinutes: 1440, defaultOn: false, hint: "Your solar energy today is worth this much at your rate." },
];
const PRESET_BY_ID = new Map(PRESETS.map((p) => [p.id, p]));
export const presetOf = (id: string): Preset | null => PRESET_BY_ID.get(id) ?? null;

export const COOLDOWN_CHOICES: { minutes: number; label: string }[] = [
  { minutes: 15, label: "15 minutes" },
  { minutes: 60, label: "1 hour" },
  { minutes: 180, label: "3 hours" },
  { minutes: 360, label: "6 hours" },
  { minutes: 1440, label: "Once a day" },
];

/** A row of alert_rules as the job and the settings page read it. */
export interface RuleRow {
  id: string;
  preset_id: string | null;
  name: string | null;
  metric: string;
  op: string;
  threshold: number | string;
  site_id: string | null;
  notify_email: boolean;
  notify_app: boolean;
  cooldown_minutes: number;
  enabled: boolean;
}

/** One alert as it is evaluated: a ready-made one (with the customer's changes) or one of their own. */
export interface EffectiveRule {
  /** stable identity for its state: "preset:battery_low" or "rule:<uuid>" */
  key: string;
  ruleId: string | null;
  presetId: string | null;
  title: string;
  metric: string;
  op: Op;
  threshold: number;
  /** the site it is limited to, or null for every site */
  siteId: string | null;
  email: boolean;
  app: boolean;
  cooldownMinutes: number;
  severity: Severity;
  enabled: boolean;
  /** true when no row changes it: it is the ready-made alert as WayTara set it up */
  untouched: boolean;
}

const isOp = (v: unknown): v is Op => v === "above" || v === "below";

/** "Battery level below 20%", "Grid cost today above ₹150". */
export function ruleSentence(metric: string, op: Op, threshold: number): string {
  const m = metricOf(metric);
  if (!m) return `${metric} ${op} ${threshold}`;
  return `${m.label} ${op} ${formatLimit(m, threshold)}`;
}

export function formatLimit(m: Metric, value: number): string {
  const n = Number.isInteger(value) ? String(value) : value.toFixed(m.step < 1 ? (m.step < 0.1 ? 2 : 1) : 1).replace(/\.0+$/, "");
  if (m.unit === "%") return `${n}%`;
  if (m.unit === "₹") return `₹${n}`;
  return `${n} ${m.unit}`;
}

/** Every alert that applies to a customer: the ready-made ones (as they set them, else as WayTara set them) and their own. */
export function effectiveRules(rows: readonly RuleRow[]): EffectiveRule[] {
  const out: EffectiveRule[] = [];
  const touched = new Map(rows.filter((r) => r.preset_id).map((r) => [r.preset_id as string, r]));
  for (const p of PRESETS) {
    const row = touched.get(p.id);
    const threshold = row ? Number(row.threshold) : p.threshold;
    out.push({
      key: `preset:${p.id}`,
      ruleId: row?.id ?? null,
      presetId: p.id,
      title: ruleSentence(p.metric, p.op, Number.isFinite(threshold) ? threshold : p.threshold),
      metric: p.metric,
      op: p.op,
      threshold: Number.isFinite(threshold) ? threshold : p.threshold,
      siteId: null,
      email: row ? row.notify_email : true,
      app: row ? row.notify_app : true,
      cooldownMinutes: row ? row.cooldown_minutes : p.cooldownMinutes,
      severity: p.severity,
      enabled: row ? row.enabled : p.defaultOn,
      untouched: !row,
    });
  }
  for (const r of rows) {
    if (r.preset_id || !isOp(r.op) || !metricOf(r.metric)) continue;
    const threshold = Number(r.threshold);
    if (!Number.isFinite(threshold)) continue;
    out.push({
      key: `rule:${r.id}`,
      ruleId: r.id,
      presetId: null,
      title: r.name?.trim() || ruleSentence(r.metric, r.op, threshold),
      metric: r.metric,
      op: r.op,
      threshold,
      siteId: r.site_id,
      email: r.notify_email,
      app: r.notify_app,
      cooldownMinutes: r.cooldown_minutes,
      severity: "warning",
      enabled: r.enabled,
      untouched: false,
    });
  }
  return out;
}

export const conditionMet = (op: Op, value: number, threshold: number): boolean => (op === "above" ? value > threshold : value < threshold);

/** Has the value moved far enough back from its limit for the alert to arm again? A small margin stops a value hovering on the limit from firing
 *  over and over. */
export function backInRange(metric: string, op: Op, value: number, threshold: number): boolean {
  const step = metricOf(metric)?.step ?? 0.1;
  const margin = Math.max(step, Math.abs(threshold) * 0.02);
  return op === "above" ? value <= threshold - margin : value >= threshold + margin;
}

export interface RuleState {
  active: boolean;
  lastFiredAt: number | null;
}

export type Decision = "fire" | "rearm" | "none";

/** What to do with a rule now: fire when the limit is crossed (once, and not again within the cooldown), arm it again once the value is back
 *  in range. A missing value (the device is not reporting) does nothing. */
export function decide(rule: Pick<EffectiveRule, "metric" | "op" | "threshold" | "cooldownMinutes">, value: number | null, state: RuleState, nowMs: number): Decision {
  if (value === null || !Number.isFinite(value)) return "none";
  const met = conditionMet(rule.op, value, rule.threshold);
  if (met && !state.active) {
    const cooled = state.lastFiredAt === null || nowMs - state.lastFiredAt >= rule.cooldownMinutes * 60_000;
    return cooled ? "fire" : "none";
  }
  if (!met && state.active && backInRange(rule.metric, rule.op, value, rule.threshold)) return "rearm";
  return "none";
}

/** "18%", "4.2 kW", "₹182". */
export function formatMetricValue(metric: string, value: number): string {
  const m = metricOf(metric);
  if (!m) return String(value);
  const digits = m.unit === "%" || m.unit === "°C" ? 0 : m.unit === "₹" ? 0 : m.step < 0.1 ? 2 : 1;
  const n = value.toFixed(digits);
  if (m.unit === "%") return `${n}%`;
  if (m.unit === "₹") return `₹${n}`;
  return `${n} ${m.unit}`;
}
