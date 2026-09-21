import { redirect } from "next/navigation";

// Sites & Devices folded into the Devices module — a site's own details
// (property type, power source, address) now live on each of its
// devices' detail pages (Site Details section), reached from
// /dashboard/devices rather than a separate read-only accordion here.
export default function SitesRedirect() {
  redirect("/dashboard/devices");
}
