import type { CustomerSite } from "@/lib/selected-site";
import { PROPERTY_TYPE_LABELS, POWER_SOURCE_LABELS, POWER_PACKAGE_LABELS } from "@/lib/site-catalog";

/** Read-only "which site is this device at" strip — the site-details
 *  counterpart to DeviceDetailsCard, shown unconditionally (not gated
 *  behind the `instrument_settings` plan feature the editable Site
 *  Setting tab is) so every customer can at least see their site's own
 *  details, same as they can already see the device's. */
export function SiteDetailsCard({ site }: { site: CustomerSite }) {
  const address = site.address;
  const addressLine = [address?.line1, address?.city, address?.state, address?.pincode].filter(Boolean).join(", ");

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-theme-border bg-theme-surface px-4 py-3 text-sm">
      <span className="font-medium text-theme-primary">{site.name}</span>
      <span className="text-theme-muted capitalize">{PROPERTY_TYPE_LABELS[site.propertyType] ?? site.propertyType}</span>
      <span className="text-theme-muted capitalize">{POWER_SOURCE_LABELS[site.powerSourceCategory] ?? site.powerSourceCategory}</span>
      {site.powerPackage && (
        <span className="text-theme-muted">{POWER_PACKAGE_LABELS[site.powerPackage] ?? site.powerPackage}</span>
      )}
      {addressLine && <span className="text-theme-muted">{addressLine}</span>}
    </div>
  );
}
