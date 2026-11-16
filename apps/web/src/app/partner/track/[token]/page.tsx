import type { Metadata } from "next";
import { PartnerTracker, PartnerTrackerClosed } from "@/components/partner/partner-tracker";
import { getTrackedApplication } from "@/lib/partner-track-server";

// Private to one applicant: never cached, never indexed, and the address is not passed on to other sites.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your application", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function PartnerTrackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const app = await getTrackedApplication(token);
  return app ? <PartnerTracker app={app} /> : <PartnerTrackerClosed />;
}
