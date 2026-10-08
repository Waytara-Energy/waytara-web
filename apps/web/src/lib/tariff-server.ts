import "server-only";
import type { createClient } from "@waytara/supabase/server";
import type { CustomerSite } from "./selected-site";
import { matchState, resolveTariff, type ResolvedTariff, type TariffRow } from "./tariff";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** The rate that applies to this site today: its state's rate for its kind of property, or - when none is on file - the rate
 *  set on the customer's own account. */
export async function fetchResolvedTariff(supabase: SupabaseServerClient, site: Pick<CustomerSite, "address" | "propertyType"> | null, accountRate: number): Promise<ResolvedTariff> {
  const state = matchState(site?.address?.state);
  const today = new Date(Date.now() + 19_800_000).toISOString().slice(0, 10);
  let rows: TariffRow[] = [];
  if (state) {
    const { data } = await supabase
      .from("electricity_tariffs")
      .select("state, category, rate_per_kwh, export_rate_per_kwh, fixed_charge_per_month, effective_from, source_url, source_note, confidence, slabs, billing_months, duty_pct, surcharge_per_kwh, free_units, free_units_cap, free_units_over_cap")
      .eq("state", state);
    rows = (data ?? []) as TariffRow[];
  }
  return resolveTariff({ rows, state, propertyType: site?.propertyType, accountRate, today });
}
