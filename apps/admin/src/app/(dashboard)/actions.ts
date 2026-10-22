"use server";

import { redirect } from "next/navigation";
import { createClient } from "@waytara/supabase/server";

export async function logout() {
  const supabase = await createClient();
  // this device only: signOut() alone defaults to the "global" scope and would end every other device's session too
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
