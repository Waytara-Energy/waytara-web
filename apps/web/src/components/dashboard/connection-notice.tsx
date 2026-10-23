"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { TriangleAlert, WifiOff } from "lucide-react";
import type { DeviceSyncInit } from "@/lib/device-sync-types";
import { CONNECTION_LABEL, type ConnectionStatus } from "@/lib/device-state";
import { clearedCookie, dismissalCookie, dismissedAtFromCookies, msUntilReshow, noticeCookieName, OFFLINE_NOTICE_REPEAT_MS } from "@/lib/offline-notice";
import { cn } from "@/lib/utils";
import { useDeviceState } from "./use-device-state";

const TOAST_ID = "device-connection";

/** What each state means, in words: the unit stopped checking in (power or internet), or the unit is online but the inverter does not answer it (the cable, or the inverter itself). */
const CAUSE: Record<Exclude<ConnectionStatus, "online">, string> = {
  offline: "The monitoring unit has stopped checking in: power or internet may be down.",
  connection_lost: "The monitoring unit is online but the inverter is not answering it.",
};

function NoticeToast({ status, onDismiss, onInvestigate }: { status: Exclude<ConnectionStatus, "online">; onDismiss: () => void; onInvestigate: () => void }) {
  const Icon = status === "offline" ? WifiOff : TriangleAlert;
  const tint = status === "offline" ? "bg-red-500/12 text-red-600" : "bg-amber-500/12 text-amber-600";
  // The same card as every other toast. It does not close by itself, so it keeps its own two buttons rather than a close icon.
  return (
    <div role="status" className="grid w-full grid-cols-[auto_1fr] items-start gap-x-3 gap-y-2.5 rounded-2xl border border-border bg-popover p-4 text-popover-foreground shadow-lg sm:w-[356px]">
      <span className={cn("flex size-9 items-center justify-center rounded-xl", tint)}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-5">{CONNECTION_LABEL[status]}</span>
        <span className="block text-xs leading-snug text-muted-foreground">{CAUSE[status]} The page shows the last readings.</span>
      </span>
      <span className="col-start-2 flex gap-2">
        <button type="button" onClick={onInvestigate} className="h-8 rounded-lg bg-foreground px-3 text-xs font-medium text-background transition-opacity hover:opacity-90">
          Check device health
        </button>
        <button type="button" onClick={onDismiss} className="h-8 rounded-lg bg-muted px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted/70">
          Dismiss
        </button>
      </span>
    </div>
  );
}

/** On every dashboard page (it is mounted in the layout): while the device is offline or the unit has lost it, a toast sits at the top of the window (on a phone, the usual notification
 *  across the top) saying the page shows the last readings, with a button that opens Maintenance's health tab. It has a
 *  Dismiss button (it never closes by itself); the dismissal is kept in a cookie. If the device is still offline 3 hours later it comes
 *  back, and so on every 3 hours until the problem is resolved (the device reports again, which also clears the cookie). */
export function ConnectionNotice({ deviceId, sync }: { deviceId: string; sync: DeviceSyncInit }) {
  const { status } = useDeviceState(deviceId, sync);
  const router = useRouter();
  // On the Maintenance page itself there is nothing to investigate (it is the place Investigate leads to), so the toast stays away.
  const onMaintenance = usePathname().startsWith("/dashboard/maintenance");

  React.useEffect(() => {
    const cookie = noticeCookieName(deviceId);
    let timer: ReturnType<typeof setTimeout> | null = null;

    if (onMaintenance) {
      toast.dismiss(TOAST_ID);
      return;
    }

    if (status === "online") {
      document.cookie = clearedCookie(deviceId); // resolved: the next outage is shown straight away
      toast.dismiss(TOAST_ID);
      return;
    }

    const schedule = (ms: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(show, ms);
    };
    const dismiss = () => {
      document.cookie = dismissalCookie(deviceId, Date.now());
      toast.dismiss(TOAST_ID);
      schedule(OFFLINE_NOTICE_REPEAT_MS); // still offline then? it comes back
    };
    function show() {
      // The cookie decides whether it is due (a reload, or another tab, may have dismissed it a moment ago).
      const wait = msUntilReshow(dismissedAtFromCookies(document.cookie, cookie), Date.now());
      if (wait > 0) {
        schedule(wait);
        return;
      }
      toast.custom(() => <NoticeToast status={status as Exclude<ConnectionStatus, "online">} onDismiss={dismiss} onInvestigate={() => { dismiss(); router.push("/dashboard/maintenance#health"); }} />, {
        id: TOAST_ID,
        duration: Infinity,
        dismissible: false,
      });
    }
    show();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [status, deviceId, router, onMaintenance]);

  // Leaving the page takes the toast with it.
  React.useEffect(() => () => void toast.dismiss(TOAST_ID), []);
  return null;
}
