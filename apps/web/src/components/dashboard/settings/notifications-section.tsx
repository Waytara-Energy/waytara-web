"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, Cpu, Headset, Lock, ReceiptText, ShieldCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import { withPromiseToast } from "@waytara/ui/notify";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ButtonSpinner } from "@/components/ui/spinner";
import { NOTIFICATION_CATEGORIES, NOTIFICATION_KEYS, type NotificationCategory, type NotificationKey } from "@/lib/notification-prefs";
import { saveNotifications, type NotificationPrefs } from "@/app/dashboard/settings/actions";
import { cn } from "@/lib/utils";

const ICON: Record<NotificationCategory["id"], LucideIcon> = { account: ShieldCheck, devices: Cpu, faults: TriangleAlert, billing: ReceiptText, support: Headset };
const TONE: Record<NotificationCategory["id"], string> = {
  account: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  devices: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  faults: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  billing: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  support: "bg-primary/15 text-primary",
};

/** Settings > Notifications: the e-mails WayTara sends, in categories (account and security, devices, faults and alarms, billing, support),
 *  each with its own switch. The bell in the app always shows everything; these only control e-mail. */
export function NotificationsSection({ initial }: { initial: NotificationPrefs }) {
  const router = useRouter();
  const [prefs, setPrefs] = React.useState<NotificationPrefs>(initial);
  const [saved, setSaved] = React.useState<NotificationPrefs>(initial);
  const [saving, setSaving] = React.useState(false);
  const dirty = NOTIFICATION_KEYS.some((k) => prefs[k] !== saved[k]);

  const set = (key: NotificationKey, value: boolean) => setPrefs((p) => ({ ...p, [key]: value }));
  const setCategory = (c: NotificationCategory, value: boolean) => setPrefs((p) => ({ ...p, ...Object.fromEntries(c.items.map((i) => [i.key, value])) }));

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
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Bell className="size-4" />
        </span>
        <p className="text-sm text-muted-foreground">Choose which e-mails WayTara sends you. The bell in the app always shows everything; these only control e-mail.</p>
      </div>

      {NOTIFICATION_CATEGORIES.map((c) => {
        const Icon = ICON[c.id];
        const onCount = c.items.filter((i) => prefs[i.key]).length;
        const allOn = onCount === c.items.length;
        return (
          <section key={c.id} className="rounded-2xl border border-border bg-card">
            <div className="flex items-start justify-between gap-4 p-5 pb-3 sm:p-6 sm:pb-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", TONE[c.id])}>
                  <Icon className="size-4" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-foreground">{c.title}</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">{c.description}</p>
                </div>
              </div>
              {c.items.length > 1 && (
                <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setCategory(c, !allOn)}>
                  {allOn ? "Turn all off" : "Turn all on"}
                </Button>
              )}
            </div>
            <div className="divide-y divide-border px-5 pb-2 sm:px-6">
              {c.items.map((i) => (
                <div key={i.key} className="flex items-center justify-between gap-4 py-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{i.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{i.description}</p>
                  </div>
                  <Switch checked={prefs[i.key]} onCheckedChange={(v) => set(i.key, v)} aria-label={i.title} />
                </div>
              ))}
              {c.always?.map((a) => (
                <div key={a.title} className="flex items-center justify-between gap-4 py-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{a.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{a.description}</p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    <Lock className="size-3" />
                    Always on
                  </span>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <div className="flex justify-end">
        <Button type="button" size="sm" disabled={!dirty || saving} onClick={() => void save()}>
          <ButtonSpinner show={saving} />
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
