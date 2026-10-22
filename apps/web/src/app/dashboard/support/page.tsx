import { cookies } from "next/headers";
import { deviceDisplayId, getCustomerSites, resolveSelectedSite, SELECTED_SITE_COOKIE } from "@/lib/selected-site";
import { NewSupportTicketDialog } from "@/components/dashboard/new-support-ticket-dialog";
import { SupportHelp } from "@/components/dashboard/support-help";

// The right side while no ticket is open: answers and guides, so many problems are solved without waiting (the ticket list is in the layout).
export default async function SupportPage() {
  const [sites, cookieStore] = await Promise.all([getCustomerSites(), cookies()]);
  const selected = resolveSelectedSite(sites, cookieStore.get(SELECTED_SITE_COOKIE)?.value);
  return (
    <SupportHelp
      newTicket={
        <NewSupportTicketDialog
          label="Open a ticket"
          variant="outline"
          sites={sites.map((s) => ({ id: s.id, name: s.name, devices: s.devices.map((d) => ({ id: d.id, name: deviceDisplayId(d) })) }))}
          defaultSiteId={selected?.id ?? sites[0]?.id ?? null}
        />
      }
    />
  );
}
