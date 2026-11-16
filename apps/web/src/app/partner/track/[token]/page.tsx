import { redirect } from "next/navigation";

// The old private tracking page. Links sent before the partner area existed still arrive here: they now lead to the start page, where the e-mail address is confirmed
// with a code and a password is chosen first. The link alone opens nothing any more.
export const dynamic = "force-dynamic";

export default async function PartnerTrackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  redirect(`/partner/start?t=${encodeURIComponent(token)}`);
}
