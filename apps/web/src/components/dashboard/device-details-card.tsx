import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { CustomerDevice } from "@/lib/selected-site";

const STATUS_BADGE_VARIANT: Record<string, BadgeProps["variant"]> = {
  active: "default",
  test: "secondary",
  offline: "alert",
  decommissioned: "outline",
};

function formatInstalledDate(installedAt: string | null): string | null {
  if (!installedAt) return null;
  return new Date(installedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** A one-line "which device am I looking at" strip — label, type +
 *  manufacturer, serial, status, install date — shown under the
 *  DevicePicker on every device-scoped page (Overview, Monitoring,
 *  Performance, Maintenance, Analytics, Reports, Instrument Settings) so a
 *  customer at a multi-device site always has the full identity of the
 *  device the rest of the page is about, not just its label in a
 *  sentence. */
export function DeviceDetailsCard({ device }: { device: CustomerDevice }) {
  const installedLabel = formatInstalledDate(device.installedAt);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-theme-border bg-theme-surface px-4 py-3 text-sm">
      <span className="font-medium text-theme-primary">{device.label || device.deviceUid}</span>
      {device.deviceType && (
        <span className="text-theme-muted">
          {device.deviceType.name}
          {device.deviceType.brand || device.deviceType.manufacturer
            ? ` · ${device.deviceType.brand ?? device.deviceType.manufacturer}`
            : ""}
          {device.deviceType.model ? ` ${device.deviceType.model}` : ""}
        </span>
      )}
      <span className="text-theme-muted">Serial {device.deviceUid}</span>
      {installedLabel && <span className="text-theme-muted">Installed {installedLabel}</span>}
      <Badge variant={STATUS_BADGE_VARIANT[device.status] ?? "secondary"} className="ml-auto capitalize">
        {device.status}
      </Badge>
    </div>
  );
}
