import { Badge, type BadgeProps } from "@/components/ui/badge";
import { deviceDisplayId, type CustomerDevice } from "@/lib/selected-site";

const STATUS_BADGE_VARIANT: Record<string, BadgeProps["variant"]> = {
  active: "default",
  test: "secondary",
  offline: "alert",
  decommissioned: "outline",
};

function formatDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** A one-line "which device am I looking at" strip — label, type +
 *  manufacturer, serial, status, install/warranty dates — shown under the
 *  DevicePicker on every device-scoped page (Overview, Monitoring,
 *  Performance, Maintenance, Analytics, Reports, Instrument Settings) so a
 *  customer at a multi-device site always has the full identity of the
 *  device the rest of the page is about, not just its label in a
 *  sentence. */
export function DeviceDetailsCard({ device }: { device: CustomerDevice }) {
  const installedLabel = formatDate(device.installedAt);
  const warrantyEndLabel = formatDate(device.warrantyEndDate);
  const warrantyExpired = device.warrantyEndDate !== null && new Date(device.warrantyEndDate) < new Date();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-theme-border bg-theme-surface px-4 py-3 text-sm">
      <span className="font-medium text-theme-primary">{deviceDisplayId(device)}</span>
      {device.deviceType && (
        <span className="text-theme-muted">
          {device.deviceType.name}
          {device.deviceType.brand || device.deviceType.manufacturer
            ? ` · ${device.deviceType.brand ?? device.deviceType.manufacturer}`
            : ""}
          {device.deviceType.model ? ` ${device.deviceType.model}` : ""}
        </span>
      )}
      {device.deviceType?.serialNumber && <span className="text-theme-muted">Serial {device.deviceType.serialNumber}</span>}
      {installedLabel && <span className="text-theme-muted">Installed {installedLabel}</span>}
      {warrantyEndLabel && (
        <span className={warrantyExpired ? "text-theme-alert" : "text-theme-muted"}>
          Warranty {warrantyExpired ? "expired" : "until"} {warrantyEndLabel}
        </span>
      )}
      <Badge variant={STATUS_BADGE_VARIANT[device.deviceStatus] ?? "secondary"} className="ml-auto capitalize">
        {device.deviceStatus}
      </Badge>
    </div>
  );
}
