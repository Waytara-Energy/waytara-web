"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BellRing, CheckCircle2, CircleAlert, History, Send } from "lucide-react";
import { notify } from "@waytara/ui/notify";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/spinner";
import type { EffectiveRule } from "@/lib/alert-rules";
import { alertTitleAndBody } from "@/lib/notification-items";
import { whenText } from "@/lib/account-events";
import { sendTestAlert } from "@/app/dashboard/settings/account-actions";
import { cn } from "@/lib/utils";
import { AlertsManager, type AlertSite } from "./alerts-manager";
import { IconBubble, Pill, SettingsCard } from "./settings-card";
import { useSettingsNav } from "./settings-nav";

export interface RecentAlert {
  id: string;
  severity: string;
  message: string;
  ts: string;
  resolved_at: string | null;
}

export interface AlertsProps {
  rules: EffectiveRule[];
  sites: AlertSite[];
  recent: RecentAlert[];
  /** the "E-mail for my alerts" switch, and whether all e-mail is paused right now */
  emailOn: boolean;
  paused: boolean;
  now: number;
}

function Tile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone: "emerald" | "amber" | "sky" }) {
  const color = { emerald: "text-emerald-600 dark:text-emerald-400", amber: "text-amber-600 dark:text-amber-400", sky: "text-sky-600 dark:text-sky-400" }[tone];
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-3xl font-semibold tracking-tight", color)}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Settings > Alerts: how many alerts are on, what has gone off lately, a test, and the alerts themselves (ready-made and the person's own). */
export function AlertsSection({ rules, sites, recent, emailOn, paused, now }: AlertsProps) {
  const router = useRouter();
  const { go } = useSettingsNav();
  const [busy, setBusy] = React.useState(false);
  const on = rules.filter((r) => r.enabled).length;
  const own = rules.filter((r) => !r.presetId).length;
  const last = recent[0];

  async function test() {
    setBusy(true);
    try {
      await sendTestAlert();
      notify.success("A test alert is in your bell, and an e-mail is on its way.");
      router.refresh();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "The test alert could not be raised.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Tile label="Alerts on" value={`${on} of ${rules.length}`} hint={own > 0 ? `${own} of them your own` : "Ready-made ones watching for you"} tone="emerald" />
        <Tile label="E-mail for alerts" value={paused ? "Paused" : emailOn ? "On" : "Off"} hint={paused ? "Notifications are paused" : emailOn ? "Each alert also has its own choice" : "The bell still shows them"} tone={paused || !emailOn ? "amber" : "sky"} />
        <Tile label="Last alert" value={last ? whenText(last.ts, now) : "None yet"} hint={last ? alertTitleAndBody(last.message, last.severity).title : "They appear in the bell and below"} tone="sky" />
      </div>

      {(!emailOn || paused) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-3.5 text-sm text-foreground">
          <span className="flex items-center gap-2">
            <CircleAlert className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            {paused ? "Notifications are paused, so alerts will not e-mail you right now." : "E-mail for your alerts is switched off, so they only appear in the bell."}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => go("notifications")}>
            Open notifications
          </Button>
        </div>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <AlertsManager rules={rules} sites={sites} />
        </div>
        <div className="space-y-5">
          <SettingsCard
            title="Try it"
            description="See what an alert looks like before a real one goes off."
            icon={BellRing}
            tone="rose"
            footer={
              <Button type="button" size="sm" disabled={busy} onClick={() => void test()}>
                <ButtonSpinner show={busy} />
                {!busy && <Send className="size-3.5" />}
                Send a test alert
              </Button>
            }
          >
            <p className="text-sm text-muted-foreground">Puts a sample alert in your bell and sends the e-mail for it, so you know both reach you.</p>
          </SettingsCard>

          <SettingsCard title="Recent alerts" description="The last ones that went off for your devices." icon={History} tone="sky">
            {recent.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">Nothing has gone off yet. That is good news.</p>
            ) : (
              <ul className="-my-2 divide-y divide-border">
                {recent.map((a) => {
                  const { title, body } = alertTitleAndBody(a.message, a.severity);
                  return (
                    <li key={a.id} className="flex items-start gap-3 py-3">
                      <IconBubble icon={a.resolved_at ? CheckCircle2 : CircleAlert} tone={a.resolved_at ? "emerald" : a.severity === "critical" ? "rose" : "amber"} className="size-8" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{title}</p>
                        <p className="line-clamp-2 text-xs text-muted-foreground">{body}</p>
                        <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          {whenText(a.ts, now)}
                          {a.resolved_at ? <Pill tone="emerald">Cleared</Pill> : <Pill tone={a.severity === "critical" ? "danger" : "amber"}>Open</Pill>}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </SettingsCard>
        </div>
      </div>
    </div>
  );
}
