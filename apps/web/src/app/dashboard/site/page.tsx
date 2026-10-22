import { MapPin } from "lucide-react";
import { getSelectedSite, resolveDeviceInSite } from "@/lib/selected-site";
import { PROPERTY_TYPE_LABELS } from "@/lib/site-catalog";
import { TONE_CIRCLE } from "@/components/dashboard/device-card";
import { SitePane } from "@/components/dashboard/site-pane";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

// The Site page (it was a tab of Devices): a headline in the same style as Performance, Maintenance and Devices, then the map, what kind of
// site it is and its details. A site belongs to the customer, not to one device; the form saves through a device of the site (the one chosen
// in the header, else the first), as it always did.
export default async function SitePage({ searchParams }: { searchParams: Promise<{ device?: string }> }) {
  const [{ device: deviceIdParam }, site] = await Promise.all([searchParams, getSelectedSite()]);
  const device = await resolveDeviceInSite(site, deviceIdParam);

  if (!site || !device) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MapPin />
          </EmptyMedia>
          <EmptyTitle>No site yet</EmptyTitle>
          <EmptyDescription>Your WayTara advisor sets this up during installation.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const figures = [
    { label: "City", value: site.address?.city ?? "—" },
    { label: "Property", value: PROPERTY_TYPE_LABELS[site.propertyType] ?? site.propertyType },
  ];

  return (
    <div className="space-y-5">
      <div className="flex min-w-0 items-center gap-4">
        <span className={`flex size-14 shrink-0 items-center justify-center rounded-full ${TONE_CIRCLE.sky}`}>
          <MapPin className="size-7" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-theme-muted">Site</p>
          <p className="truncate text-3xl font-semibold leading-tight tracking-tight text-theme-primary sm:text-4xl">{site.name}</p>
        </div>
        <div className="hidden items-center gap-8 pl-6 md:flex">
          {figures.map((f) => (
            <div key={f.label}>
              <p className="text-sm font-medium text-theme-muted">{f.label}</p>
              <p className="text-2xl font-semibold tracking-tight text-theme-primary">{f.value}</p>
            </div>
          ))}
        </div>
      </div>

      <SitePane device={device} site={site} />
    </div>
  );
}
