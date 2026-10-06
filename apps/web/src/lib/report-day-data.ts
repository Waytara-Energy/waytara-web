import "server-only";
import { createClient } from "@waytara/supabase/server";
import { getSelectedSite, resolveDeviceInSite, deviceDisplayId } from "@/lib/selected-site";
import { getCustomerPlan } from "@/lib/customer-plan";
import { getRequestProfile } from "@/lib/request-profile";
import { fetchSeriesRows } from "@/lib/device-readings-fetch";
import {
  REPORT_BUCKET_OPTIONS,
  DEFAULT_REPORT_BUCKET_MINUTES,
  bucketKeyIst,
  dayBucketKeys,
  availableReportTypes,
  getReportType,
  resolveReportType,
  isValidReportDate,
  istDayStart,
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
  type: ReportType;
  bucketMinutes: number;
  /** True when the day was older than the 15-minute retention and was read from hourly rollups. */
  coarse: boolean;
  points: ReportPoint[];
  summaries: ReportSeriesSummary[];
  hasData: boolean;
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
  type?: string | null;
  bucketMinutes?: string | null;
}): Promise<DayReportResult> {
  const date = params.date ?? todayIst();
  if (!isValidReportDate(date)) return { ok: false, status: 400, error: "Pick a valid date that is not in the future." };

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
  };

  if (!isSolar) {
    return {
      ok: true,
      report: { ...base, type: getReportType(params.type), bucketMinutes, coarse: false, points: [], summaries: [], hasData: false },
    };
  }

  // Only what this device's equipment_metrics enables (read + show_for_user). A requested
  // report the device can't draw, or an unknown id, falls back to the first one it can.
  const enabled = await getEnabledMetricKeys(device.id);
  const type = resolveReportType(getReportType(params.type), enabled) ?? availableReportTypes(enabled)[0];
  if (!type) return { ok: false, status: 404, error: "No report metrics are enabled for this device." };

  const dayStart = istDayStart(date);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  // 15-minute data is kept for 8 days; older days exist as hourly (and daily) rollups only.
  const ageDays = (Date.now() - dayStart.getTime()) / (24 * 60 * 60 * 1000);
  const coarse = ageDays > FINE_RETENTION_DAYS;
  if (coarse && bucketMinutes < 60) bucketMinutes = 60;

  const { sampleKeys, counterKeys } = reportKeys(type);
  const supabase = await createClient();

  // One request for the day's buckets of every metric the report needs, and one for the inverter's own energy
  // counters (the day's maximum) - in parallel. Both read the rollup tables; nothing here touches raw readings.
  const [bucketRows, counterRows] = await Promise.all([
    fetchSeriesRows(supabase, device.id, sampleKeys, dayStart.toISOString(), dayEnd.toISOString(), bucketMinutes),
    counterKeys.length > 0 ? fetchSeriesRows(supabase, device.id, counterKeys, dayStart.toISOString(), dayEnd.toISOString(), 1440) : Promise.resolve([]),
  ]);

  // bucket key -> metric -> that bucket's figures
  const raw = new Map<string, RawBuckets>();
  const covered = new Map<string, Record<string, number>>();
  for (const r of bucketRows) {
    const key = bucketKeyIst(r.bucket, date, bucketMinutes);
    if (key === null) continue;
    const row = raw.get(key) ?? {};
    row[r.key_name] = { avg: r.avg_value, pos: r.pos_avg, neg: r.neg_avg };
    raw.set(key, row);
    const c = covered.get(key) ?? {};
    c[r.key_name] = r.covered_s ?? 0;
    covered.set(key, c);
  }

  const counters: Record<string, number | null> = {};
  for (const r of counterRows) counters[r.key_name] = r.max_value;

  const points: ReportPoint[] = dayBucketKeys(date, bucketMinutes).map((time) => {
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

  const summaries = type.series.map((s) => summarizeSeries(s, points, bucketMinutes, counters));
  const hasData = points.some((p) => type.series.some((s) => typeof p[s.id] === "number"));

  return { ok: true, report: { ...base, type, bucketMinutes, coarse, points, summaries, hasData } };
}
