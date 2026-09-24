import "server-only";
import { createClient } from "@waytara/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** Categories disabled for this specific physical installation — absence
 *  of a device_feature_flags row means enabled, so only disabled
 *  categories ever get a row (see device_feature_flags' own table
 *  comment). The one shared place every read/settings fetcher checks
 *  before either building a tab list or querying device_readings/
 *  device_settings, so a future page can't reintroduce a fetch for a
 *  disabled category by forgetting a check that used to live in 3
 *  different files. */
export async function getDisabledCategories(supabase: SupabaseServerClient, deviceId: string): Promise<Set<string>> {
  const { data } = await supabase.from("device_feature_flags").select("category").eq("device_id", deviceId).eq("is_enabled", false);
  return new Set((data ?? []).map((f) => f.category));
}
