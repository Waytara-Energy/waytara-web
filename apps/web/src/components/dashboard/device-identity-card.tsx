import { Sun, Plug, Cpu, MapPin, type LucideIcon } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { deviceDisplayId, type CustomerDevice, type CustomerSite } from "@/lib/selected-site";
import { PROPERTY_TYPE_LABELS, POWER_SOURCE_LABELS, POWER_PACKAGE_LABELS } from "@/lib/site-catalog";

export const STATUS_BADGE_VARIANT: Record<string, BadgeProps["variant"]> = {
  active: "default",
  test: "secondary",
  offline: "alert",
  decommissioned: "outline",
};

const CATEGORY_ICON: Record<string, LucideIcon> = {
  solar_inverter: Sun,
  ev_charger: Plug,
};

function formatDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** The Devices page's own hero — replaces what used to be two separate flat
 *  info strips (a device one and a site one) with a single card: an icon
 *  avatar for the device's category, its identity (name, model, serial,
 *  install/warranty dates) with a status badge, a divider, then the site
 *  it's installed at as one compact line. DeviceSwitcher above this card
 *  already carries the page's own "which device" heading, so this is pure
 *  identity detail — no titles repeated. */
export function DeviceIdentityCard({ device, site }: { device: CustomerDevice; site: CustomerSite }) {
  const installedLabel = formatDate(device.installedAt);
  const warrantyEndLabel = formatDate(device.warrantyEndDate);
  const warrantyExpired = device.warrantyEndDate !== null && new Date(device.warrantyEndDate) < new Date();
  const Icon = CATEGORY_ICON[device.deviceType?.category ?? ""] ?? Cpu;

  const address = site.address;
  const addressLine = [address?.line1, address?.city, address?.state, address?.pincode].filter(Boolean).join(", ");
  const siteMeta = [
    PROPERTY_TYPE_LABELS[site.propertyType] ?? site.propertyType,
    POWER_SOURCE_LABELS[site.powerSourceCategory] ?? site.powerSourceCategory,
    site.powerPackage ? (POWER_PACKAGE_LABELS[site.powerPackage] ?? site.powerPackage) : null,
    addressLine || null,
  ].filter((v): v is string => Boolean(v));

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Icon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-theme-primary">{deviceDisplayId(device)}</p>
              {device.deviceType && (
                <p className="mt-0.5 truncate text-sm text-theme-muted">
                  {device.deviceType.name}
                  {device.deviceType.brand || device.deviceType.manufacturer
                    ? ` · ${device.deviceType.brand ?? device.deviceType.manufacturer}`
                    : ""}
                  {device.deviceType.model ? ` ${device.deviceType.model}` : ""}
                </p>
              )}
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-theme-muted">
                {device.deviceType?.serialNumber && <span>Serial {device.deviceType.serialNumber}</span>}
                {installedLabel && <span>Installed {installedLabel}</span>}
                {warrantyEndLabel && (
                  <span className={warrantyExpired ? "font-medium text-theme-alert" : undefined}>
                    Warranty {warrantyExpired ? "expired" : "until"} {warrantyEndLabel}
                  </span>
                )}
              </p>
            </div>
          </div>
          <Badge variant={STATUS_BADGE_VARIANT[device.deviceStatus] ?? "secondary"} className="shrink-0 capitalize">
            {device.deviceStatus}
          </Badge>
        </div>

        <Separator className="my-4" />

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
          <span className="flex items-center gap-1.5 font-medium text-theme-primary">
            <MapPin className="size-3.5 shrink-0 text-theme-muted" />
            {site.name}
          </span>
          {siteMeta.map((label) => (
            <span key={label} className="flex items-center gap-2 text-theme-muted">
              <span className="text-theme-border">·</span>
              {label}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
