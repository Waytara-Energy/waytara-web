"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { TriangleAlert, WifiOff } from "lucide-react";
import type { DeviceSyncInit } from "@/lib/device-sync-types";
import { CONNECTION_LABEL, type ConnectionStatus } from "@/lib/device-state";
import { clearedCookie, dismissalCookie, dismissedAtFromCookies, msUntilReshow, noticeCookieName, OFFLINE_NOTICE_REPEAT_MS } from "@/lib/offline-notice";
import { useDeviceState } from "./use-device-state";

const TOAST_ID = "device-connection";

/** What each state means, in words: the unit stopped checking in (power or internet), or the unit is online but the inverter does not answer it (the cable, or the inverter itself). */
const CAUSE: Record<Exclude<ConnectionStatus, "online">, string> = {
  offline: "The monitoring unit has stopped checking in: power or internet may be down.",
  connection_lost: "The monitoring unit is online but the inverter is not answering it.",
};

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
      const offline = status === "offline";
      const Icon = offline ? WifiOff : TriangleAlert;
      // The shared toast card (so it looks like every other toast); it never closes by itself, so it carries its own two buttons.
      (offline ? toast.error : toast.warning)(CONNECTION_LABEL[status as Exclude<ConnectionStatus, "online">], {
        id: TOAST_ID,
        description: `${CAUSE[status as Exclude<ConnectionStatus, "online">]} The page shows the last readings.`,
        icon: <Icon className="size-4" />,
        duration: Infinity,
        dismissible: false,
        action: { label: "Check device health", onClick: () => { dismiss(); router.push("/dashboard/maintenance#health"); } },
        cancel: { label: "Dismiss", onClick: dismiss },
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
