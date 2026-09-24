import type { createClient } from "@waytara/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Sum of every `paid` payment on the signed-in customer's account (RLS
 * scopes `payments` to them, same "RLS scopes it, not the query" pattern
 * used elsewhere) — account-wide, not device-scoped, since payments aren't
 * tied to a device.
 *
 * Was the same `.from("payments").select("amount, status").eq("status",
 * "paid")` + reduce duplicated in gather-report-data.ts (Reports page, CSV
 * export, PDF export) and analytics-content.tsx's SolarInverterAnalytics —
 * one shared helper instead of two copies that could drift.
 *
 * Takes an existing client rather than creating its own: unlike
 * `getCustomerPlan`, both call sites already have a request-scoped
 * `supabase` client in hand (one from its own `createClient()`, one passed
 * down as a prop), so there's nothing to dedupe by wrapping this in
 * `cache()` — each caller already fetches this at most once.
 */
export async function getTotalInvested(supabase: SupabaseServerClient): Promise<number> {
  const { data } = await supabase.from("payments").select("amount, status").eq("status", "paid").limit(2000);
  return (data ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
}
