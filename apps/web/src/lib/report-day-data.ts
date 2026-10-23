import "server-only";
import { createClient } from "@waytara/supabase/server";
import { getSelectedSite, resolveDeviceInSite, deviceDisplayId } from "@/lib/selected-site";
import { getCustomerPlan } from "@/lib/customer-plan";
import { getRequestProfile } from "@/lib/request-profile";
import { fetchSeriesRows } from "@/lib/device-readings-fetch";
import { planRange } from "@/lib/telemetry/ranges";
import { cadenceConfigured, readCadence } from "@/lib/cadence-hub";
import { bucketCadenceForReport } from "@/lib/cadence-parse";
import { CADENCE_GROUP_STEP_S, cadenceGroupOf } from "@/lib/cadence-keys";
import { findGaps, MIN_GAP_MS, withCauses, type DataGap } from "@/lib/data-gaps";
import { loadOutages } from "@/lib/outages";
import {
  REPORT_BUCKET_OPTIONS,
  DEFAULT_REPORT_BUCKET_MINUTES,
  CADENCE_RETENTION_DAYS,
  isCadenceMinutes,
  type CadenceReading,
  istBucketKey,
  windowBucketKeys,
  MAX_REPORT_DAYS,
  availableReportTypes,
  getReportType,
  resolveReportType,
  isValidReportDate,
  istDayStart,
  inWindow,
  normalizeWindow,
  resolveSelection,
  type TimeWindow,
  reportKeys,
  summarizeSeries,
  todayIst,
  type RawBuckets,
  type ReportPoint,
  type ReportSeriesSummary,
  type ReportType,
} from "@/lib/report-types";

// 15-minute rollups are kept for 8 days (older days exist as hourly and daily rollups only).
const FINE_RETENTION_DAYS = 7.5;

export interface DayReport {
  authorized: boolean;
  customerName: string;
  planName: string;
  deviceId: string | null;
  deviceLabel: string | null;
  isSolar: boolean;
  date: string;
  /** How many consecutive days the report covers, starting on `date` (1 = a single day). */
  days: number;
  type: ReportType;
  /** The part of each day that was asked for (null = the whole day). */
  window: TimeWindow | null;
  bucketMinutes: number;
  /** True when the day was older than the 15-minute retention and was read from hourly rollups. */
  coarse: boolean;
  points: ReportPoint[];
  summaries: ReportSeriesSummary[];
  hasData: boolean;
  /** The stretches inside the report when the device sent no readings (offline, or its connection lost). */
  gaps: DataGap[];
}

export type DayReportResult = { ok: true; report: DayReport } | { ok: false; status: number; error: string };

/** The keys this device's equipment_metrics enables for customers: direction 'read'
 *  and show_for_user. RLS lets a customer read only their own devices' rows. */
export async function getEnabledMetricKeys(deviceId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("equipment_metrics")
    .select("key_name")
    .eq("equipment_id", deviceId)
    .eq("direction", "read")
    .eq("show_for_user", true);
  return new Set((data ?? []).map((r) => r.key_name));
}

export function parseBucketMinutes(value: string | null | undefined): number {
  const n = Number(value);
  return REPORT_BUCKET_OPTIONS.some((o) => o.minutes === n) ? n : DEFAULT_REPORT_BUCKET_MINUTES;
}

/**
 * One customer-visible day (00:00-23:59:59 IST) of one report type, bucketed.
 * Shared by the JSON route behind the chart and by the CSV and PDF exports so
 * the three can never disagree. Auth is the signed-in customer's own cookie
 * session; RLS scopes every query to their devices, and the device id is
 * resolved against their own site list rather than trusted from the request.
 */
export async function gatherDayReport(params: {
  deviceId?: string;
  date?: string | null;
  days?: string | null;
  type?: string | null;
  /** Single readings to show together ("solar,load"); used instead of `type` when given. */
  series?: string | null;
  /** Only this part of each day, "HH:mm" (India time). */
  from?: string | null;
  to?: string | null;
  bucketMinutes?: string | null;
  /** For the 1 / 5 minute steps: "avg" (the average of the readings in the step) or "last" (the reading at that time). */
  reading?: string | null;
}): Promise<DayReportResult> {
  const date = params.date ?? todayIst();
  if (!isValidReportDate(date)) return { ok: false, status: 400, error: "Pick a valid date that is not in the future." };
  const daysRaw = params.days ? Number(params.days) : 1;
  if (!Number.isInteger(daysRaw) || daysRaw < 1 || daysRaw > MAX_REPORT_DAYS) {
    return { ok: false, status: 400, error: `A report covers 1 to ${MAX_REPORT_DAYS} days.` };
  }
  // Never past today: a window that would run into the future is cut at today.
  const days = Math.min(daysRaw, Math.max(1, Math.round((istDayStart(todayIst()).getTime() - istDayStart(date).getTime()) / 86_400_000) + 1));

  const window = normalizeWindow(params.from, params.to);
  if ((params.from || params.to) && !window && !(params.from === "00:00" && params.to && params.to >= "23:59")) {
    return { ok: false, status: 400, error: "Pick a start time that is before the end time." };
  }
  const seriesIds = (params.series ?? "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 12);

  const [profile, site] = await Promise.all([getRequestProfile(), getSelectedSite()]);
  if (!profile) return { ok: false, status: 401, error: "Please sign in." };
  const plan = await getCustomerPlan();
  if (!plan?.features?.reports) return { ok: false, status: 403, error: "Not available on your plan." };

  const device = await resolveDeviceInSite(site, params.deviceId);
  if (!device) return { ok: false, status: 404, error: "No device found." };

  let bucketMinutes = parseBucketMinutes(params.bucketMinutes);
  const isSolar = device.deviceType?.category === "solar_inverter";

  const base = {
    authorized: true,
    customerName: profile.full_name ?? "Customer",
    planName: plan.planName ?? "—",
    deviceId: device.id,
    deviceLabel: deviceDisplayId(device),
    isSolar,
    date,
    days,
  };

  if (!isSolar) {
    return {
      ok: true,
      report: { ...base, type: getReportType(params.type), window, bucketMinutes, coarse: false, points: [], summaries: [], hasData: false, gaps: [] },
    };
  }

  // Only what this device's equipment_metrics enables (read + show_for_user). A requested
  // report the device can't draw, or an unknown id, falls back to the first one it can.
  const enabled = await getEnabledMetricKeys(device.id);
  const type = (seriesIds.length > 0 ? resolveSelection(seriesIds, enabled) : null) ?? resolveReportType(getReportType(params.type), enabled) ?? availableReportTypes(enabled)[0];
  if (!type) return { ok: false, status: 404, error: "No report metrics are enabled for this device." };

  const dayStart = istDayStart(date);
  const windowEnd = new Date(dayStart.getTime() + days * 24 * 60 * 60 * 1000);
  // 1 / 5 minute steps come from the device's readings at their own rhythm (cadence history), one day at a time.
  const fromCadence = isCadenceMinutes(bucketMinutes) && days === 1;
  const reading: CadenceReading = params.reading === "last" ? "last" : "avg";
  if (isCadenceMinutes(bucketMinutes) && !fromCadence) bucketMinutes = DEFAULT_REPORT_BUCKET_MINUTES;
  if (fromCadence) {
    if (!cadenceConfigured()) return { ok: false, status: 503, error: "Minute-by-minute readings are not set up yet." };
    if (Date.now() - dayStart.getTime() > CADENCE_RETENTION_DAYS * 86_400_000) {
      return { ok: false, status: 400, error: `Minute-by-minute readings are kept for ${CADENCE_RETENTION_DAYS} days. Pick a 15 minute or longer interval for this day.` };
    }
  }
  // What the database can serve for this window (15-minute data is kept 8 days, at most 750 points per metric):
  // the requested interval if allowed, else the plan's default for the span.
  const rangePlan = planRange({ fromMs: dayStart.getTime(), toMs: windowEnd.getTime() }, Date.now());
  if (!fromCadence) bucketMinutes = rangePlan.options.includes(bucketMinutes) ? bucketMinutes : rangePlan.default;
  const coarse = !fromCadence && bucketMinutes >= 60 && days === 1 && Date.now() - dayStart.getTime() > FINE_RETENTION_DAYS * 86_400_000;

  const { sampleKeys, counterKeys } = reportKeys(type);
  const supabase = await createClient();

  // One request for the day's buckets of every metric the report needs, and one for the inverter's own energy
  // counters (the day's maximum) - in parallel. Both read the rollup tables; nothing here touches raw readings.
  // (For a 1 / 5 minute step the day's readings come from the cadence history instead of the 15-minute rollups.)
  let cadenceError: string | null = null;
  const [bucketRows, counterRows, cadence] = await Promise.all([
    fromCadence ? Promise.resolve([]) : fetchSeriesRows(supabase, device.id, sampleKeys, dayStart.toISOString(), windowEnd.toISOString(), bucketMinutes),
    counterKeys.length > 0 ? fetchSeriesRows(supabase, device.id, counterKeys, dayStart.toISOString(), windowEnd.toISOString(), 1440) : Promise.resolve([]),
    fromCadence
      ? readCadence(device.id, sampleKeys, dayStart.getTime(), Math.min(windowEnd.getTime(), Date.now())).catch((e: unknown) => {
          cadenceError = e instanceof Error ? e.message : "The minute-by-minute readings are unavailable.";
          return null;
        })
      : Promise.resolve(null),
  ]);
  if (fromCadence && cadenceError) return { ok: false, status: 502, error: cadenceError };

  // bucket key -> metric -> that bucket's figures
  let raw = new Map<string, RawBuckets>();
  let covered = new Map<string, Record<string, number>>();
  if (cadence) {
    ({ raw, covered } = bucketCadenceForReport(cadence.series, (k) => CADENCE_GROUP_STEP_S[cadenceGroupOf(k) ?? "slow_30s"], bucketMinutes, reading, (ms, m) => istBucketKey(new Date(ms), m)));
  }
  for (const r of bucketRows) {
    const key = istBucketKey(r.bucket, bucketMinutes);
    const row = raw.get(key) ?? {};
    row[r.key_name] = { avg: r.avg_value, pos: r.pos_avg, neg: r.neg_avg };
    raw.set(key, row);
    const c = covered.get(key) ?? {};
    c[r.key_name] = r.covered_s ?? 0;
    covered.set(key, c);
  }

  const counters: Record<string, number | null> = {};
  // A day's counter value is its highest reading; a window's total is the sum over its days.
  for (const r of counterRows) if (r.max_value !== null) counters[r.key_name] = (counters[r.key_name] ?? 0) + r.max_value;

  const points: ReportPoint[] = windowBucketKeys(date, days, bucketMinutes).filter((time) => inWindow(time, window)).map((time) => {
    const sample = raw.get(time) ?? {};
    const point: ReportPoint = { time };
    for (const s of type.series) {
      const has = Object.keys(sample).length > 0;
      point[s.id] = has ? s.compute(sample) : null;
      // the seconds this series was actually reported: the most any of its metrics covered
      point[`${s.id}:c`] = has ? Math.max(0, ...s.keys.map((k) => covered.get(time)?.[k] ?? 0)) : null;
    }
    return point;
  });

  // The inverter's own energy count is for the whole day, so a part of the day is worked out from its readings instead.
  const summaries = type.series.map((s) => summarizeSeries(s, points, bucketMinutes, window ? {} : counters));
  const hasData = points.some((p) => type.series.some((s) => typeof p[s.id] === "number"));

  // Data gaps: bucket by bucket, where no series has a reading for half an hour or more (the buckets are the report's own, in India time).
  const slotMs = bucketMinutes * 60_000;
  const slotTimes = points.map((p) => Date.parse(`${p.time}:00+05:30`));
  const slotHas = points.map((p) => type.series.some((s) => typeof p[s.id] === "number"));
  const found = slotTimes.length > 0 ? findGaps(slotTimes, slotHas, slotMs, Date.now(), { minMs: Math.max(MIN_GAP_MS, slotMs), endMs: slotTimes[slotTimes.length - 1] + slotMs }) : [];
  // why each one happened, from the outages the platform recorded (only looked up when there is a gap to explain)
  const gaps: DataGap[] = found.length > 0 ? withCauses(found, await loadOutages(supabase, device.id, found[0].fromMs - 3_600_000)) : found;

  return { ok: true, report: { ...base, type, window, bucketMinutes, coarse, points, summaries, hasData, gaps } };
}
