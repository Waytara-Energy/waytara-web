import "server-only";
import { cache } from "react";
import { createClient } from "@waytara/supabase/server";
import { getRequestProfile } from "@/lib/request-profile";

export interface CustomerPlan {
  planName: string | null;
  features: Record<string, boolean>;
  tariffRatePerKwh: number;
}

/**
 * The one place every page's feature-gate check and the layout's sidebar/
 * header both get the signed-in customer's plan — `customers` joined to
 * `plans` was previously queried fresh by the layout AND by five separate
 * pages (Monitoring, Performance, Analytics, Instrument Settings, plus
 * the layout itself), all for the same row. Wrapped in `cache()` the same
 * way `getCurrentProfile`/`getCustomerDevices` are: one real query per
 * request no matter how many of those six places ask for it. Uses
 * `getRequestProfile()` (not `getCurrentProfile()` directly) so resolving
 * the signed-in profile itself is also free here in the common case — see
 * @/lib/request-profile for why that matters for navigation latency.
 */
export const getCustomerPlan = cache(async (): Promise<CustomerPlan | null> => {
  const profile = await getRequestProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("tariff_rate_per_kwh, plan:plans(name, features)")
    .eq("id", profile.id)
    .maybeSingle();

  if (!data) return null;

  return {
    planName: data.plan?.name ?? null,
    features: (data.plan?.features as Record<string, boolean>) ?? {},
    tariffRatePerKwh: Number(data.tariff_rate_per_kwh ?? 8),
  };
});
