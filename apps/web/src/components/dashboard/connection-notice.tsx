"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TriangleAlert, WifiOff } from "lucide-react";
import type { DeviceSyncInit } from "@/lib/device-sync-types";
import { CONNECTION_LABEL, type ConnectionStatus } from "@/lib/device-state";
import { clearedCookie, dismissalCookie, dismissedAtFromCookies, msUntilReshow, noticeCookieName, OFFLINE_NOTICE_REPEAT_MS } from "@/lib/offline-notice";
import { cn } from "@/lib/utils";
import { useDeviceState } from "./use-device-state";

const TOAST_ID = "device-connection";

function NoticeToast({ status, onDismiss, onInvestigate }: { status: Exclude<ConnectionStatus, "online">; onDismiss: () => void; onInvestigate: () => void }) {
  const Icon = status === "offline" ? WifiOff : TriangleAlert;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onDismiss}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onDismiss()}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-xl border bg-popover px-4 py-3 text-popover-foreground shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-[356px]",
        status === "offline" ? "border-red-500/50" : "border-amber-500/50"
      )}
    >
      <Icon className={cn("size-5 shrink-0", status === "offline" ? "text-red-500" : "text-amber-500")} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{CONNECTION_LABEL[status]}</span>
        <span className="block text-xs text-muted-foreground">Showing the last readings · tap to dismiss</span>
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation(); // going to Maintenance, not just closing it
          onInvestigate();
        }}
        className="shrink-0 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90"
      >
        Investigate
      </button>
    </div>
  );
}

/** While the device is offline or the unit has lost it, a toast sits at the top of the window (on a phone, the usual notification
 *  across the top) saying the page shows the last readings, with an Investigate button that opens Maintenance. It has no close
 *  button: clicking it dismisses it, and the dismissal is kept in a cookie. If the device is still offline 3 hours later it comes
 *  back, and so on every 3 hours until the problem is resolved (the device reports again, which also clears the cookie). */
export function ConnectionNotice({ deviceId, sync }: { deviceId: string; sync: DeviceSyncInit }) {
  const { status } = useDeviceState(deviceId, sync);
  const router = useRouter();

  React.useEffect(() => {
    const cookie = noticeCookieName(deviceId);
    let timer: ReturnType<typeof setTimeout> | null = null;

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
      toast.custom(() => <NoticeToast status={status as Exclude<ConnectionStatus, "online">} onDismiss={dismiss} onInvestigate={() => { dismiss(); router.push("/dashboard/maintenance"); }} />, {
        id: TOAST_ID,
        duration: Infinity,
        dismissible: false,
      });
    }
    show();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [status, deviceId, router]);

  // Leaving the page takes the toast with it.
  React.useEffect(() => () => void toast.dismiss(TOAST_ID), []);
  return null;
}
