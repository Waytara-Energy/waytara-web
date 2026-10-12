import Link from "next/link";
import { CloudSun } from "lucide-react";
import { getSelectedSite } from "@/lib/selected-site";
import { fetchForecast } from "@/lib/weather";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { WeatherForecast } from "@/components/dashboard/weather-forecast";

export const metadata = { title: "Weather forecast" };

function Message({ title, description, action }: { title: string; description: string; action?: boolean }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CloudSun />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action && (
        <EmptyContent>
          <Button asChild size="sm">
            <Link href="/dashboard/devices#site">Open the Site tab</Link>
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}

// The weather forecast for the selected site: the days ahead, and for each its weather, the sun and the sunshine for solar. The place comes from
// the site's saved location in the database.
export default async function WeatherPage() {
  const site = await getSelectedSite();
  if (!site) return <Message title="No site yet" description="Your WayTara advisor sets this up during installation." />;
  if (site.latitude === null || site.longitude === null) return <Message title="No location saved for this site" description="Save the site's location on the map and its weather forecast appears here." action />;

  const forecast = await fetchForecast(site.latitude, site.longitude);
  if (!forecast || forecast.days.length === 0) return <Message title="The forecast could not be loaded" description="The weather service did not answer just now. Try again in a few minutes." />;

  return <WeatherForecast siteName={site.name} city={site.address?.city ?? null} forecast={forecast} />;
}
