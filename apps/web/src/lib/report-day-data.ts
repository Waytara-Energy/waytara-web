import "server-only";
import { createClient } from "@waytara/supabase/server";
import { getSelectedSite, resolveDeviceInSite, deviceDisplayId } from "@/lib/selected-site";
import { getCustomerPlan } from "@/lib/customer-plan";
import { getRequestProfile } from "@/lib/request-profile";
import {
  REPORT_BUCKET_OPTIONS,
  DEFAULT_REPORT_BUCKET_MINUTES,
  bucketKeyIst,
  dayBucketKeys,
  getReportType,
  isValidReportDate,
  istDayStart,
  reportKeys,
  summarizeSeries,
  todayIst,
  type ReportPoint,
  type ReportSeriesSummary,
  type ReportType,
} from "@/lib/report-types";

// Raw readings are purged after 90 days (purge_old_telemetry); the hourly
// rollup is kept. Dates close to or past that limit are served from the rollup
// at one-hour resolution rather than showing an empty chart.
const RAW_RETENTION_SAFE_DAYS = 85;
const PAGE_SIZE = 1000; // PostgREST's per-request row cap
const MAX_PAGES = 40;

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
  /** True when the day was older than raw retention and was read from hourly averages. */
  coarse: boolean;
  points: ReportPoint[];
  summaries: ReportSeriesSummary[];
  hasData: boolean;
}

export type DayReportResult = { ok: true; report: DayReport } | { ok: false; status: number; error: string };

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

  const type = getReportType(params.type);
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
    type,
  };

  if (!isSolar) {
    return {
      ok: true,
      report: { ...base, bucketMinutes, coarse: false, points: [], summaries: [], hasData: false },
    };
  }

  const dayStart = istDayStart(date);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const ageDays = (Date.now() - dayStart.getTime()) / (24 * 60 * 60 * 1000);
  const coarse = ageDays > RAW_RETENTION_SAFE_DAYS;
  if (coarse) bucketMinutes = 60;

  const { sampleKeys, counterKeys } = reportKeys(type);
  const supabase = await createClient();

  // bucket key -> raw key -> bucket average
  const raw = new Map<string, Record<string, number>>();
  const put = (key: string | null, name: string, value: number | null) => {
    if (key === null || value === null) return;
    let row = raw.get(key);
    if (!row) raw.set(key, (row = {}));
    row[name] = value;
  };

  if (coarse) {
    for (let page = 0; page < MAX_PAGES; page++) {
      const { data } = await supabase
        .from("equipment_telemetry_hourly")
        .select("key_name, hour, avg_value")
        .eq("equipment_id", device.id)
        .in("key_name", sampleKeys)
        .gte("hour", dayStart.toISOString())
        .lt("hour", dayEnd.toISOString())
        .order("hour", { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (!data || data.length === 0) break;
      for (const r of data) put(bucketKeyIst(r.hour, date, 60), r.key_name, r.avg_value);
      if (data.length < PAGE_SIZE) break;
    }
  } else {
    // 5-minute buckets x several keys is well over 1,000 rows, so page through
    // the (deterministically ordered) RPC result instead of taking the first page.
    for (let page = 0; page < MAX_PAGES; page++) {
      const { data } = await supabase
        .rpc("telemetry_buckets", {
          p_equipment_id: device.id,
          p_keys: sampleKeys,
          p_from: dayStart.toISOString(),
          p_to: dayEnd.toISOString(),
          p_bucket_minutes: bucketMinutes,
        })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (!data || data.length === 0) break;
      for (const r of data) put(bucketKeyIst(r.bucket, date, bucketMinutes), r.key_name, r.avg_value as number | null);
      if (data.length < PAGE_SIZE) break;
    }
  }

  const counters: Record<string, number | null> = {};
  if (counterKeys.length > 0) {
    const { data } = await supabase.rpc("telemetry_daily", {
      p_equipment_id: device.id,
      p_keys: counterKeys,
      p_from: dayStart.toISOString(),
      p_to: dayEnd.toISOString(),
    });
    for (const r of data ?? []) counters[r.key_name] = r.max_value as number | null;
  }

  const points: ReportPoint[] = dayBucketKeys(date, bucketMinutes).map((time) => {
    const sample = raw.get(time) ?? {};
    const point: ReportPoint = { time };
    for (const s of type.series) point[s.id] = Object.keys(sample).length > 0 ? s.compute(sample) : null;
    return point;
  });

  const summaries = type.series.map((s) => summarizeSeries(s, points, bucketMinutes, counters));
  const hasData = points.some((p) => type.series.some((s) => typeof p[s.id] === "number"));

  return { ok: true, report: { ...base, bucketMinutes, coarse, points, summaries, hasData } };
}
