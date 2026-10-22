import { redirect } from "next/navigation";

// An old address: the site's details have their own page, "Site", in the menu under Maintenance.
export default function SitesRedirect() {
  redirect("/dashboard/site");
}
