import { createClient } from "@waytara/supabase/server";
import { getSelectedDevice } from "@/lib/selected-device";
import { getCustomerPlan } from "@/lib/customer-plan";
import { getRequestProfile } from "@/lib/request-profile";
import { maxByDeviceDay, sumByDay, type DailyPoint } from "@/lib/energy-aggregation";

const YIELD_INSTRUMENT_KEY = "daily_yield_kwh";

export interface ReportData {
  authorized: boolean;
  customerName: string;
  planName: string;
  deviceLabel: string | null;
  tariffRate: number;
  daily: DailyPoint[];
  totalKwh: number;
  totalSaved: number;
  totalInvested: number;
  roiPct: number | null;
}

const UNAUTHORIZED: ReportData = {
  authorized: false,
  customerName: "",
  planName: "",
  deviceLabel: null,
  tariffRate: 0,
  daily: [],
  totalKwh: 0,
  totalSaved: 0,
  totalInvested: 0,
  roiPct: null,
};

/**
 * Shared by the Reports page, the CSV export route, and the PDF export
 * route — all three need the same RLS-scoped dataset, and duplicating this
 * query/aggregation three times is how they'd eventually disagree.
 * `historyDays` controls how far back readings are pulled (the CSV/PDF
 * period selector).
 *
 * Device-centric redesign: resolves the *selected* device itself (same
 * getSelectedDevice() every other device-scoped page uses) rather than
 * taking a customer-wide "every device" query — the sites/site-comparison
 * concept this used to carry is gone along with that, since a report is
 * now about one device, not a multi-site rollup.
 */
export async function gatherReportData(historyDays: number): Promise<ReportData> {
  // These two routes (energy.csv, summary.pdf) sit outside proxy.ts's
  // /dashboard/:path* matcher, so getRequestProfile() always takes its
  // fallback path here (a real getCurrentProfile() call) — still correct,
  // just not free the way it is on a /dashboard/* page. getCustomerPlan()
  // replaces what used to be this file's own customers/plan query — the
  // 6th copy of that exact query found in this codebase, see
  // @/lib/customer-plan for the other five. profile and device don't
  // depend on each other, so they run together.
  const [profile, device] = await Promise.all([getRequestProfile(), getSelectedDevice()]);
  if (!profile) return UNAUTHORIZED;

  const supabase = await createClient();
  const customerPlan = await getCustomerPlan();

  const features = customerPlan?.features ?? {};
  if (!features.reports) {
    return { ...UNAUTHORIZED, customerName: profile.full_name ?? "", planName: customerPlan?.planName ?? "" };
  }

  const tariffRate = customerPlan?.tariffRatePerKwh ?? 8;

  if (!device) {
    return {
      authorized: true,
      customerName: profile.full_name ?? "Customer",
      planName: customerPlan?.planName ?? "—",
      deviceLabel: null,
      tariffRate,
      daily: [],
      totalKwh: 0,
      totalSaved: 0,
      totalInvested: 0,
      roiPct: null,
    };
  }

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - historyDays);

  // Independent of each other — one round trip instead of two.
  const [{ data: readings }, { data: payments }] = await Promise.all([
    supabase
      .from("device_readings")
      .select("device_id, value, ts")
      .eq("device_id", device.id)
      .eq("instrument_key", YIELD_INSTRUMENT_KEY)
      .eq("is_test", false)
      .gte("ts", since.toISOString())
      .order("ts", { ascending: true }),
    supabase.from("payments").select("amount, status").eq("status", "paid"),
  ]);
  const totalInvested = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

  const perDeviceDay = maxByDeviceDay(readings ?? []);
  const daily = sumByDay(perDeviceDay);
  const totalKwh = daily.reduce((sum, p) => sum + p.value, 0);
  const totalSaved = totalKwh * tariffRate;
  const roiPct = totalInvested > 0 ? (totalSaved / totalInvested) * 100 : null;

  return {
    authorized: true,
    customerName: profile.full_name ?? "Customer",
    planName: customerPlan?.planName ?? "—",
    deviceLabel: device.label || device.deviceUid,
    tariffRate,
    daily,
    totalKwh,
    totalSaved,
    totalInvested,
    roiPct,
  };
}

/** Buckets a daily series into ISO-week (Monday-anchored) sums, most recent
 *  first, capped to `maxWeeks` rows for a report table. */
export function toWeeklyRows(daily: DailyPoint[], maxWeeks = 12): { label: string; kwh: number }[] {
  const buckets = new Map<string, number>();
  for (const point of daily) {
    const date = new Date(point.date + "T00:00:00Z");
    const day = (date.getDay() + 6) % 7;
    const monday = new Date(date);
    monday.setUTCDate(monday.getUTCDate() - day);
    const key = monday.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + point.value);
  }
  const rows = Array.from(buckets.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, maxWeeks)
    .map(([mondayStr, kwh]) => {
      const monday = new Date(mondayStr + "T00:00:00Z");
      const sunday = new Date(monday);
      sunday.setUTCDate(sunday.getUTCDate() + 6);
      const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      return { label: `${fmt(monday)} – ${fmt(sunday)}`, kwh };
    });
  return rows;
}
