"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, Send } from "lucide-react";
import { notify, withPromiseToast } from "@waytara/ui/notify";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/spinner";
import { pauseNotifications, sendTestEmail } from "@/app/dashboard/settings/account-actions";
import { cn } from "@/lib/utils";

const PAUSES: { minutes: number; label: string }[] = [
  { minutes: 60, label: "1 hour" },
  { minutes: 480, label: "8 hours" },
  { minutes: 1440, label: "1 day" },
  { minutes: 10_080, label: "1 week" },
];

/** The top of Settings > Notifications: whether e-mails are coming, a way to pause them for a while (holiday, a quiet day: security e-mails still
 *  arrive), and a test e-mail so the person can see that they reach them. */
export function PauseCard({ pausedUntil, email }: { pausedUntil: string | null; email: string }) {
  const router = useRouter();
  const [until, setUntil] = React.useState(pausedUntil);
  const [seen, setSeen] = React.useState(pausedUntil);
  if (pausedUntil !== seen) {
    setSeen(pausedUntil);
    setUntil(pausedUntil);
  }
  const [now] = React.useState(() => Date.now());
  const [busy, setBusy] = React.useState<string | null>(null);
  const paused = until !== null && Date.parse(until) > now;

  async function pause(minutes: number | null) {
    setBusy(String(minutes));
    const ok = await withPromiseToast(pauseNotifications, { loading: "Saving…", success: minutes === null ? "Notifications are back on." : "Notifications paused." })(minutes);
    setBusy(null);
    // the page re-reads the saved time and hands it back down as pausedUntil
    if (ok) router.refresh();
  }

  async function test() {
    setBusy("test");
    try {
      const r = await sendTestEmail();
      notify.success(`Test e-mail sent to ${r.to}.`);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "The test e-mail could not be sent.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={cn("overflow-hidden rounded-2xl border p-5 shadow-sm sm:p-6", paused ? "border-amber-500/40 bg-gradient-to-r from-amber-500/10 to-card" : "border-border bg-gradient-to-r from-emerald-500/5 to-card")}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-full", paused ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400")}>{paused ? <BellOff className="size-6" /> : <Bell className="size-6" />}</span>
        <div className="min-w-0 flex-1 basis-64">
          <h2 className="text-lg font-semibold text-foreground">
            {paused ? `Notifications are paused until ${new Date(until!).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}` : "Notifications are on"}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {paused ? "No e-mails except the ones about the security of your account. The bell in the app keeps showing everything." : `We e-mail ${email}. Choose what below, or pause everything for a while: e-mails about the security of your account always arrive.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {paused ? (
            <Button type="button" size="sm" disabled={busy !== null} onClick={() => void pause(null)}>
              <ButtonSpinner show={busy === "null"} />
              Turn notifications back on
            </Button>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-medium text-muted-foreground">Pause for</span>
              {PAUSES.map((p) => (
                <Button key={p.minutes} type="button" variant="outline" size="sm" className="h-8" disabled={busy !== null} onClick={() => void pause(p.minutes)}>
                  {p.label}
                </Button>
              ))}
            </div>
          )}
          <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => void test()}>
            <ButtonSpinner show={busy === "test"} />
            {busy !== "test" && <Send className="size-3.5" />}
            Send a test e-mail
          </Button>
        </div>
      </div>
    </section>
  );
}
