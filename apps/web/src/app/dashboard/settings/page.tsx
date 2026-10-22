import { createClient } from "@waytara/supabase/server";
import { requireCustomer } from "@waytara/supabase/auth";
import { SettingsBoard } from "@/components/dashboard/settings/settings-board";
import type { SignedInDevice } from "@/components/dashboard/devices-setting";
import { parseAddress } from "@/lib/address";
import { resolveNotificationPrefs } from "@/lib/notification-prefs";
import { parseOverviewPrefs } from "@/lib/overview-prefs";
import { parseSessionPolicy } from "@/lib/session-policy";
import { fetchUnitFields } from "@/lib/unit-fields";
import { parseUnitPrefs } from "@/lib/unit-prefs";
import { getSelectedSite } from "@/lib/selected-site";

/** The server clock for "last active 5 min ago" (a function, so a render never reads the time itself). */
const serverNow = () => Date.now();

// Application Settings: profile (photo, name, phone, e-mail), appearance, the Overview cards and background, notifications, addresses and
// billing details, and account & security (password, how long a browser may sit idle, signed-in devices). The page reads everything it
// needs together; the board shows one section at a time.
export default async function SettingsPage() {
  const profile = await requireCustomer();
  const supabase = await createClient();
  const site = await getSelectedSite();
  const [{ data: row }, { data: customer }, { data: sessionRows }, unitValues] = await Promise.all([
    supabase.from("profiles").select("full_name, phone, email, avatar_url, notification_preferences, ui_preferences, security_preferences").eq("id", profile.id).maybeSingle(),
    supabase.from("customers").select("address, billing_address, billing_email, gstin").eq("id", profile.id).maybeSingle(),
    supabase.rpc("my_sessions"),
    // the readings of the selected site's devices whose unit can be changed (for the "particular values" list of Units)
    fetchUnitFields(supabase, (site?.devices ?? []).map((d) => d.id)),
  ]);

  const overview = parseOverviewPrefs(row?.ui_preferences);
  const imageUrl = overview.background.kind === "image" ? supabase.storage.from("avatars").getPublicUrl(overview.background.path).data.publicUrl : null;
  const devices: SignedInDevice[] = (sessionRows ?? []).map((s) => ({ id: s.id, lastActive: s.last_active, createdAt: s.created_at, userAgent: s.user_agent, ip: s.ip, isCurrent: s.is_current }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-theme-primary">Application Settings</h1>
        <p className="mt-1 text-sm text-theme-muted">Your profile, how the app looks, and how your account is kept safe.</p>
      </div>

      <SettingsBoard
        profile={{ userId: profile.id, fullName: row?.full_name ?? "", phone: row?.phone ?? "", email: row?.email ?? profile.email ?? "", avatarUrl: row?.avatar_url ?? null }}
        notifications={{ initial: resolveNotificationPrefs(row?.notification_preferences) }}
        addresses={{ address: parseAddress(customer?.address), billing: customer?.billing_address ? parseAddress(customer.billing_address) : null, billingEmail: customer?.billing_email ?? "", gstin: customer?.gstin ?? "" }}
        overview={{ userId: profile.id, initial: overview, imageUrl }}
        units={{ initial: parseUnitPrefs(row?.ui_preferences), values: unitValues }}
        security={{ policy: parseSessionPolicy(row?.security_preferences), devices, now: serverNow() }}
      />
    </div>
  );
}
