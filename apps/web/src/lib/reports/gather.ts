import "server-only";
import { createClient } from "@waytara/supabase/server";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { getSelectedSite, resolveDeviceInSite, deviceDisplayId } from "@/lib/selected-site";
import { getCustomerPlan } from "@/lib/customer-plan";
import { getRequestProfile } from "@/lib/request-profile";
import { getTotalInvested } from "@/lib/total-invested";
import { fetchResolvedTariff } from "@/lib/tariff-server";
import { fetchDailyMaxReadings } from "@/lib/device-readings-fetch";
import { DAY_KEYS, LIFETIME_KEYS } from "@/lib/performance-metrics";
import { EMISSION_FACTOR, emissionFactorNote } from "@/lib/emission-factor";
import { CATEGORY_LABEL } from "@/lib/tariff";
import type { Bill, DayEnergy, MonthRow } from "@/lib/savings";
import { fmtDate } from "@/lib/savings";
import { daysFromRows, lifetimeBillFor, lifetimeFrom, pricedMonths, type Lifetime } from "./solar-history";

type Sb = Awaited<ReturnType<typeof createClient>>;

/** How far back the day-by-day history is read: two years, enough for a year-on-year comparison (the database serves at most 750 daily points per metric). */
const HISTORY_DAYS = 730;

export interface ReportsBase {
  authorized: boolean;
  customerName: string;
  /** The customer's own e-mail address (the default recipient of a report). */
  customerEmail: string | null;
  planName: string;
  siteName: string | null;
  deviceId: string | null;
  deviceLabel: string | null;
  /** The device is a solar inverter (the energy reports are written for one). */
  isSolar: boolean;
  generatedAt: string;
  /** Today in IST (YYYY-MM-DD). */
  today: string;
  /** The first day with readings (the earliest a report can start). */
  firstDay: string | null;
  days: DayEnergy[];
  months: MonthRow[];
  lifetime: Lifetime | null;
  lifetimeBill: Bill | null;
  invested: number;
  /** "Tamil Nadu residential tariff, in force since 10 May 2026" and how sure it is, for the footnote. */
  tariffNote: string;
  tariffIndicative: boolean;
  co2KgPerKwh: number;
  co2Note: string;
}

const NONE: ReportsBase = {
  authorized: false,
  customerName: "",
  customerEmail: null,
  planName: "",
  siteName: null,
  deviceId: null,
  deviceLabel: null,
  isSolar: false,
  generatedAt: "",
  today: "",
  firstDay: null,
  days: [],
  months: [],
  lifetime: null,
  lifetimeBill: null,
  invested: 0,
  tariffNote: "",
  tariffIndicative: false,
  co2KgPerKwh: EMISSION_FACTOR.kgPerKwh,
  co2Note: emissionFactorNote(),
};

const istToday = () => new Date(Date.now() + 19_800_000).toISOString().slice(0, 10);

interface Loaded {
  supabase: Sb;
  customerName: string;
  customerEmail: string | null;
  planName: string;
  site: { name: string; address: unknown; propertyType: string } | null;
  device: { id: string; label: string };
  accountRate: number;
  invested: number;
}

/** The history, tariff and bills of one solar inverter - the same whoever asks (a signed-in customer, or the scheduled job). */
async function loadSolar(a: Loaded): Promise<ReportsBase> {
  const today = istToday();
  const site = a.site as Parameters<typeof fetchResolvedTariff>[1];
  const tariff = await fetchResolvedTariff(a.supabase, site, a.accountRate);
  const rates = { rate: tariff.rate, exportRate: tariff.exportRate, schedule: tariff.schedule, netMetering: tariff.netMetering };
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - HISTORY_DAYS);

  const [dailyRows, { data: latestRows }, { data: range }] = await Promise.all([
    fetchDailyMaxReadings(a.supabase, a.device.id, [DAY_KEYS.pv, DAY_KEYS.load, DAY_KEYS.imported, DAY_KEYS.exported, DAY_KEYS.charged, DAY_KEYS.discharged], since.toISOString()),
    a.supabase.from("equipment_latest").select("key_name, value").eq("equipment_id", a.device.id).in("key_name", [LIFETIME_KEYS.pv, LIFETIME_KEYS.load, LIFETIME_KEYS.imported, LIFETIME_KEYS.exported]),
    a.supabase.rpc("device_data_range", { p_equipment_id: a.device.id }),
  ]);

  const days = daysFromRows(dailyRows);
  const months = pricedMonths(days, tariff.timeline, rates, today);
  const lifetime = lifetimeFrom(new Map((latestRows ?? []).map((r) => [r.key_name, r.value])));
  const row = Array.isArray(range) ? range[0] : range;
  const where = tariff.state ? `${tariff.state} ${CATEGORY_LABEL[tariff.category]}` : CATEGORY_LABEL[tariff.category];
  return {
    ...NONE,
    authorized: true,
    customerName: a.customerName,
    customerEmail: a.customerEmail,
    planName: a.planName,
    siteName: a.site?.name ?? null,
    deviceId: a.device.id,
    deviceLabel: a.device.label,
    isSolar: true,
    generatedAt: new Date().toISOString(),
    today,
    days,
    months,
    lifetime,
    lifetimeBill: lifetimeBillFor(days, months, lifetime, rates),
    invested: a.invested,
    firstDay: (row?.first_day as string | undefined) ?? null,
    tariffNote: `${where} tariff${tariff.effectiveFrom ? `, in force since ${fmtDate(tariff.effectiveFrom)}` : ""}${tariff.confidence === "indicative" ? ", indicative: not yet checked against the regulator order" : ""}`,
    tariffIndicative: tariff.confidence === "indicative",
  };
}

/** Everything the Reports page, the downloads and the saved reports need, read once and priced on the same tariff Performance uses. */
export async function gatherReportsBase(deviceIdParam?: string): Promise<ReportsBase> {
  const [profile, site] = await Promise.all([getRequestProfile(), getSelectedSite()]);
  const device = await resolveDeviceInSite(site, deviceIdParam);
  if (!profile) return NONE;

  const customerPlan = await getCustomerPlan();
  const common: ReportsBase = {
    ...NONE,
    customerName: profile.full_name ?? "Customer",
    customerEmail: profile.email ?? null,
    planName: customerPlan?.planName ?? "—",
    siteName: site?.name ?? null,
    generatedAt: new Date().toISOString(),
    today: istToday(),
  };
  if (!(customerPlan?.features ?? {}).reports) return { ...NONE, customerName: common.customerName, customerEmail: common.customerEmail, planName: common.planName };
  if (!device) return { ...common, authorized: true };

  const isSolar = device.deviceType?.category === "solar_inverter";
  if (!isSolar) return { ...common, authorized: true, deviceId: device.id, deviceLabel: deviceDisplayId(device), isSolar: false };

  const supabase = await createClient();
  return loadSolar({
    supabase,
    customerName: common.customerName,
    customerEmail: common.customerEmail,
    planName: common.planName,
    site,
    device: { id: device.id, label: deviceDisplayId(device) },
    accountRate: customerPlan?.tariffRatePerKwh ?? 8,
    invested: await getTotalInvested(supabase),
  });
}

/** The same for a scheduled report: there is no signed-in user, so the customer and device are named, and every query is limited to
 *  that customer. Returns null when the customer, device or plan no longer allows it. */
export async function gatherReportsBaseForCustomer(customerId: string, equipmentId: string | null): Promise<ReportsBase | null> {
  const supabase = createServiceRoleClient() as unknown as Sb;
  const [{ data: profile }, { data: customer }, { data: sites }] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", customerId).maybeSingle(),
    supabase.from("customers").select("tariff_rate_per_kwh, plan:plans(name, features)").eq("id", customerId).maybeSingle(),
    supabase.from("sites").select("name, property_type, address, equipment(id, label, parent_id, device_type:equipment_inventory(category, serial_number, model_number))").eq("customer_id", customerId),
  ]);
  if (!profile || !customer) return null;
  const features = (customer.plan?.features as Record<string, boolean> | undefined) ?? {};
  if (!features.reports) return null;

  // The report's device, among the customer's own devices (or their first inverter when it was not named).
  type Dev = { id: string; label: string | null; parent_id: string | null; device_type: { category: string; serial_number: string | null; model_number: string | null } | null };
  const owned = (sites ?? []).flatMap((s) => ((s.equipment ?? []) as unknown as Dev[]).filter((d) => d.parent_id === null).map((d) => ({ site: s, device: d })));
  const hit = owned.find((o) => o.device.id === equipmentId) ?? owned.find((o) => o.device.device_type?.category === "solar_inverter");
  if (!hit || hit.device.device_type?.category !== "solar_inverter") return null;

  const { data: payments } = await supabase.from("payments").select("amount").eq("customer_id", customerId).eq("status", "paid").limit(2000);
  return loadSolar({
    supabase,
    customerName: profile.full_name ?? "Customer",
    customerEmail: profile.email ?? null,
    planName: customer.plan?.name ?? "—",
    site: { name: hit.site.name, address: hit.site.address, propertyType: hit.site.property_type },
    device: { id: hit.device.id, label: hit.device.label || hit.device.device_type?.serial_number || hit.device.device_type?.model_number || "Device" },
    accountRate: Number(customer.tariff_rate_per_kwh ?? 8),
    invested: (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0),
  });
}
