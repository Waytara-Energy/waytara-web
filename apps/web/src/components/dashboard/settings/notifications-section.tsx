"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { withPromiseToast } from "@waytara/ui/notify";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ButtonSpinner } from "@/components/ui/spinner";
import { saveNotifications, type NotificationPrefs } from "@/app/dashboard/settings/actions";
import { SettingsCard, ToggleRow } from "./settings-card";

const ROWS: { key: keyof NotificationPrefs; title: string; description: string }[] = [
  { key: "email_alerts", title: "Device alerts", description: "An e-mail when a device goes offline, comes back, or raises a fault, and when your tariff changes." },
  { key: "support_emails", title: "Support replies", description: "An e-mail when the team takes your ticket, replies, or resolves it. We skip it if you already read the reply in the app." },
  { key: "email_maintenance_updates", title: "Service and maintenance updates", description: "An e-mail about service visits and maintenance on your site." },
];

/** Settings > Notifications: which e-mails we send. The bell in the app always shows everything; these only control e-mail. */
export function NotificationsSection({ initial }: { initial: NotificationPrefs }) {
  const router = useRouter();
  const [prefs, setPrefs] = React.useState<NotificationPrefs>(initial);
  const [saved, setSaved] = React.useState<NotificationPrefs>(initial);
  const [saving, setSaving] = React.useState(false);
  const dirty = ROWS.some((r) => prefs[r.key] !== saved[r.key]);

  async function save() {
    setSaving(true);
    const ok = await withPromiseToast(saveNotifications, { loading: "Saving…", success: "Notification settings saved." })(prefs);
    setSaving(false);
    if (ok) {
      setSaved(prefs);
      router.refresh();
    }
  }

  return (
    <SettingsCard
      title="E-mail notifications"
      description="Choose what we e-mail you about. The bell in the app always shows everything; these only control e-mail."
      footer={
        <Button type="button" size="sm" disabled={!dirty || saving} onClick={() => void save()}>
          <ButtonSpinner show={saving} />
          {saving ? "Saving…" : "Save changes"}
        </Button>
      }
    >
      <div className="divide-y divide-border">
        {ROWS.map((r) => (
          <ToggleRow key={r.key} title={r.title} description={r.description}>
            <Switch checked={prefs[r.key]} onCheckedChange={(v) => setPrefs((p) => ({ ...p, [r.key]: v }))} aria-label={r.title} />
          </ToggleRow>
        ))}
      </div>
    </SettingsCard>
  );
}
