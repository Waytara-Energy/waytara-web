import { HeaderLeft } from "./header-left";
import { HeaderSlotTarget } from "./header-slot";
import { NotificationCenter, type NotificationDevice } from "./notification-center";
import type { SwitcherSite } from "./site-switcher";
import type { AlertRow } from "./recent-alerts";

// No bar and no line: it is the page's own colour, and the content that scrolls up under it fades out over a thin strip at its
// bottom edge (the `after` gradient) instead of meeting a border. The site switcher is at the top left (after the brand button on a phone,
// or after the floating one when the sidebar is closed); the top right holds whatever the page puts in the header slot - the
// Overview's Go Live and connection status - then the notification bell. Search and the account live in the sidebar.
export function DashboardHeader({
  sites,
  selectedSiteId,
  alertDeviceIds,
  devices,
  initialAlerts,
  initialFaults,
}: {
  sites: SwitcherSite[];
  selectedSiteId: string | null;
  /** Every device across every one of the customer's sites - the bell isn't scoped to the selected site. */
  alertDeviceIds: string[];
  /** Their names, for the notification panel. */
  devices: NotificationDevice[];
  initialAlerts: AlertRow[];
  /** The fault each device reports right now (null = none). */
  initialFaults: Record<string, number | null>;
}) {
  return (
    <header className="absolute inset-x-0 top-0 z-20 flex h-[clamp(3.5rem,4.5vw,4.25rem)] items-center justify-between gap-3 bg-background px-4 after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-3 after:bg-gradient-to-b after:from-background after:to-transparent">
      <HeaderLeft sites={sites} selectedSiteId={selectedSiteId} />
      <div className="flex min-w-0 items-center justify-end gap-3">
        <HeaderSlotTarget className="flex min-w-0 items-center" />
        <NotificationCenter deviceIds={alertDeviceIds} devices={devices} initialAlerts={initialAlerts} initialFaults={initialFaults} />
      </div>
    </header>
  );
}
