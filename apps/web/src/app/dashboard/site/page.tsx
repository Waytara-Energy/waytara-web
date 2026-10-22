import { MapPin } from "lucide-react";
import { getSelectedSite, resolveDeviceInSite } from "@/lib/selected-site";
import { SitePane } from "@/components/dashboard/site-pane";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

// The Site page (it was a tab of Devices): one full-page map with the site's cards floating over it. A site belongs to the customer, not to
// one device; the form saves through a device of the site (the one chosen in the header, else the first), as it always did.
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

  return <SitePane device={device} site={site} />;
}
