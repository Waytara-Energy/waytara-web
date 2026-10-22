import "server-only";
import { cache } from "react";
import { createClient } from "@waytara/supabase/server";
import { getRequestProfile } from "./request-profile";
import { DEFAULT_UNIT_PREFS, parseUnitPrefs, type UnitPrefs } from "./unit-prefs";

/** The unit choices of the signed-in person, for a page that formats readings on the server. One read per request, however many components ask.
 *  (Components that run in the browser use `useUnits()` instead.) */
export const getUnitPrefs = cache(async function getUnitPrefs(): Promise<UnitPrefs> {
  const profile = await getRequestProfile();
  if (!profile) return DEFAULT_UNIT_PREFS;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("ui_preferences").eq("id", profile.id).maybeSingle();
  return parseUnitPrefs(data?.ui_preferences);
});
