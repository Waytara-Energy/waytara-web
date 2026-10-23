"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BellRing, Cpu, Headset, Lock, ReceiptText, ShieldCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { NOTIFICATION_CATEGORIES, type NotificationCategory, type NotificationKey } from "@/lib/notification-prefs";
import { saveNotifications, type NotificationPrefs } from "@/app/dashboard/settings/actions";
import { PauseCard } from "./pause-card";
import { TwoColumns } from "./settings-card";
import { useAutoSave } from "./use-auto-save";
import { cn } from "@/lib/utils";

const ICON: Record<NotificationCategory["id"], LucideIcon> = { account: ShieldCheck, devices: Cpu, faults: TriangleAlert, alerts: BellRing, billing: ReceiptText, support: Headset };
const TONE: Record<NotificationCategory["id"], string> = {
  account: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  devices: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  faults: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  alerts: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  billing: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  support: "bg-primary/15 text-primary",
};

// The categories shared between the two columns so that both come out about as tall.
const LEFT: NotificationCategory["id"][] = ["account", "faults", "alerts"];

/** Settings > Notifications: the e-mails WayTara sends, in categories (account and security, devices, faults and alarms, billing, support),
 *  each with its own switch. A switch saves the moment it is moved: there is no Save button. The bell in the app always shows everything; these
 *  only control e-mail. */
export function NotificationsSection({ initial, pausedUntil, email }: { initial: NotificationPrefs; pausedUntil: string | null; email: string }) {
  const router = useRouter();
  const { value: prefs, update } = useAutoSave<NotificationPrefs>(initial, saveNotifications, { onSaved: () => router.refresh(), message: "Notification settings saved." });

  const set = (key: NotificationKey, value: boolean) => update((p) => ({ ...p, [key]: value }));
  const setCategory = (c: NotificationCategory, value: boolean) => update((p) => ({ ...p, ...Object.fromEntries(c.items.map((i) => [i.key, value])) }));

  const card = (c: NotificationCategory) => {
    const Icon = ICON[c.id];
    const allOn = c.items.every((i) => prefs[i.key]);
    return (
      <section key={c.id} className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-start justify-between gap-4 p-5 pb-3 sm:p-6 sm:pb-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", TONE[c.id])}>
              <Icon className="size-5" />
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
  };

  return (
    <div className="space-y-5">
      <PauseCard pausedUntil={pausedUntil} email={email} />
      <TwoColumns left={NOTIFICATION_CATEGORIES.filter((c) => LEFT.includes(c.id)).map(card)} right={NOTIFICATION_CATEGORIES.filter((c) => !LEFT.includes(c.id)).map(card)} />
    </div>
  );
}
