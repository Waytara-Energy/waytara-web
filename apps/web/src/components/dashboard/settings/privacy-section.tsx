"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellRing, Cpu, Eraser, History, Home, LifeBuoy, MonitorX, ScrollText, ShieldAlert, Trash2, WalletCards, type LucideIcon } from "lucide-react";
import { notify, withPromiseToast } from "@waytara/ui/notify";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { RETENTION_CHOICES } from "@/lib/account-events";
import type { SettingsTab } from "@/lib/account-health";
import { clearActivityHistory, saveActivityRetention } from "@/app/dashboard/settings/account-actions";
import { cn } from "@/lib/utils";
import { IconBubble, Pill, SettingsCard, type Tone } from "./settings-card";
import { useSettingsNav } from "./settings-nav";

export interface HeldRow {
  id: string;
  label: string;
  count: number;
  hint: string;
  /** where to look at or change it: a tab of these settings or a page */
  tab?: SettingsTab;
  href?: string;
}

export interface PrivacyProps {
  email: string;
  held: HeldRow[];
  activity: { days: number; total: number; clearable: number };
}

const ICON: Record<string, { icon: LucideIcon; tone: Tone }> = {
  sites: { icon: Home, tone: "teal" },
  devices: { icon: Cpu, tone: "sky" },
  alerts: { icon: BellRing, tone: "amber" },
  tickets: { icon: LifeBuoy, tone: "violet" },
  payments: { icon: WalletCards, tone: "emerald" },
  activity: { icon: History, tone: "indigo" },
};

/** The keys this app keeps in the browser (the idle timer, the session clock, the closed-browser marker). */
const BROWSER_KEY = /^wt:/;

/** Settings > Privacy & data: what WayTara keeps about you, how long your sign-in history is kept (and clearing it), what this browser remembers,
 *  how your data is handled, and asking for the account to be deleted. */
export function PrivacySection({ email, held, activity }: PrivacyProps) {
  const router = useRouter();
  const { go } = useSettingsNav();
  const [days, setDays] = React.useState(activity.days);
  const [seen, setSeen] = React.useState(activity.days);
  if (activity.days !== seen) {
    setSeen(activity.days);
    setDays(activity.days);
  }
  const [clearing, setClearing] = React.useState(false);

  async function keepFor(d: number) {
    const before = days;
    setDays(d);
    const ok = await withPromiseToast(saveActivityRetention, { loading: "Saving…", success: `Activity is kept for ${RETENTION_CHOICES.find((c) => c.days === d)?.label}.` })(d);
    if (ok) router.refresh();
    else setDays(before);
  }

  async function clear() {
    setClearing(true);
    try {
      const r = await clearActivityHistory();
      notify.success(r.removed > 0 ? `Removed ${r.removed} ${r.removed === 1 ? "entry" : "entries"}.` : "There was nothing to remove.");
      router.refresh();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Could not clear the history.");
    } finally {
      setClearing(false);
    }
  }

  function forgetBrowser() {
    let removed = 0;
    for (const store of [window.localStorage, window.sessionStorage]) {
      try {
        for (let i = store.length - 1; i >= 0; i--) {
          const k = store.key(i);
          if (k && BROWSER_KEY.test(k)) {
            store.removeItem(k);
            removed++;
          }
        }
      } catch {
        /* storage is blocked: nothing is kept there either */
      }
    }
    notify.success(removed > 0 ? "This browser has forgotten its timers and markers." : "This browser had nothing stored.");
  }

  const deletion = new URLSearchParams({
    new: "1",
    category: "account",
    subject: "Please delete my account",
    message: `I would like my WayTara account (${email}) and the data it holds to be deleted. Please tell me what happens to my devices and my warranty, and what you need from me to go ahead.`,
  });
  const about = new URLSearchParams({ new: "1", category: "account", subject: "A question about my data" });

  return (
    <div className="space-y-5">
      <div className="-mb-5 columns-1 gap-5 xl:columns-2 [&>*]:mb-5 [&>*]:break-inside-avoid">
        <SettingsCard title="What WayTara keeps about you" description="Everything below belongs to your account. Open any of it to look at it or change it." icon={ScrollText} tone="sky">
          <ul className="-my-1 divide-y divide-border">
            {held.map((h) => {
              const look = ICON[h.id] ?? { icon: ScrollText, tone: "slate" as Tone };
              const row = (
                <>
                  <IconBubble icon={look.icon} tone={look.tone} className="size-9" />
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block text-sm font-medium text-foreground">{h.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{h.hint}</span>
                  </span>
                  <Pill>{h.count}</Pill>
                </>
              );
              const cls = "flex w-full items-center gap-3 py-3 outline-none transition-colors hover:text-emerald-600 focus-visible:underline dark:hover:text-emerald-400";
              return (
                <li key={h.id}>
                  {h.href ? (
                    <Link href={h.href} className={cls}>
                      {row}
                    </Link>
                  ) : (
                    <button type="button" className={cls} onClick={() => h.tab && go(h.tab)}>
                      {row}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </SettingsCard>

        <SettingsCard
          title="Your sign-in history"
          description="Sign-ins, sign-outs and changes to your account, kept so you can spot anything that was not you. Choose how long, or clear it."
          icon={History}
          tone="indigo"
        >
          <div role="radiogroup" aria-label="How long to keep the history" className="grid grid-cols-3 gap-2">
            {RETENTION_CHOICES.map((c) => {
              const on = days === c.days;
              return (
                <button
                  key={c.days}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => void keepFor(c.days)}
                  className={cn("rounded-xl border px-3 py-2.5 text-center text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-accent")}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">Older entries are removed as new ones are written.</p>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-3.5">
            <p className="min-w-0 flex-1 basis-56 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{activity.total}</span> {activity.total === 1 ? "entry" : "entries"} now, <span className="font-medium text-foreground">{activity.clearable}</span> of them sign-ins and sign-outs you can clear. Changes to your password, e-mail and two-factor sign-in stay, so a trace is always left.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" size="sm" disabled={clearing || activity.clearable === 0}>
                  <Eraser className="size-3.5" />
                  Clear sign-in history
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear your sign-in history?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {activity.clearable} sign-in and sign-out {activity.clearable === 1 ? "entry is" : "entries are"} removed for good. Changes to your password, e-mail and two-factor sign-in are kept.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void clear()}>Clear it</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </SettingsCard>

        <SettingsCard title="This browser" description="WayTara keeps a few small markers in this browser: the clock for staying signed in, and the mark that tells a closed browser from an open one." icon={MonitorX} tone="slate">
          <Button type="button" variant="outline" size="sm" onClick={forgetBrowser}>
            <Eraser className="size-3.5" />
            Forget what this browser remembers
          </Button>
          <p className="text-xs text-muted-foreground">You stay signed in. The timers start again from now.</p>
        </SettingsCard>

        <SettingsCard title="How your data is handled" description="What we do with it, and who to ask." icon={ScrollText} tone="violet">
          <ul className="-my-1 divide-y divide-border text-sm">
            <li>
              <Link href="/privacy" className="flex items-center justify-between py-3 font-medium text-foreground transition-colors hover:text-emerald-600 dark:hover:text-emerald-400">
                Privacy Policy
                <span className="text-xs font-normal text-muted-foreground">What we collect and why</span>
              </Link>
            </li>
            <li>
              <Link href="/terms" className="flex items-center justify-between py-3 font-medium text-foreground transition-colors hover:text-emerald-600 dark:hover:text-emerald-400">
                Terms of Service
                <span className="text-xs font-normal text-muted-foreground">The agreement</span>
              </Link>
            </li>
            <li>
              <Link href="/cookies" className="flex items-center justify-between py-3 font-medium text-foreground transition-colors hover:text-emerald-600 dark:hover:text-emerald-400">
                Cookie Policy
                <span className="text-xs font-normal text-muted-foreground">What the site stores in your browser</span>
              </Link>
            </li>
          </ul>
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href={`/dashboard/support?${about}`}>
              <LifeBuoy className="size-3.5" />
              Ask a question about my data
            </Link>
          </Button>
        </SettingsCard>
      </div>

      <section className="overflow-hidden rounded-2xl border border-destructive/40 bg-destructive/5 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4 p-5 sm:p-6">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <ShieldAlert className="size-5" />
          </span>
          <div className="min-w-0 flex-1 basis-72">
            <h2 className="text-base font-semibold text-foreground">Delete my account</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Ask the team to delete your account and the data it holds. Your devices and your warranty are involved, so a person from WayTara replies to you first and nothing is deleted until you confirm.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="size-3.5" />
                Ask for deletion
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Ask for your account to be deleted?</AlertDialogTitle>
                <AlertDialogDescription>
                  This opens a support ticket with your request already written. Nothing is deleted yet: the team replies, explains what happens to your devices and your warranty, and asks you to confirm.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Not now</AlertDialogCancel>
                <AlertDialogAction asChild>
                  <Link href={`/dashboard/support?${deletion}`}>Open the request</Link>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>
    </div>
  );
}
