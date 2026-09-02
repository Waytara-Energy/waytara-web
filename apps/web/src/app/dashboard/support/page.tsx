import { LifeBuoy } from "lucide-react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

// Placeholder — the real ticket list + chat thread lands in Phase 6/7 of
// the dashboard redesign (see the approved plan). Linked from the sidebar
// now so the nav item has somewhere real to go rather than a 404.
export default function SupportPage() {
  return (
    <div className="max-w-2xl">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LifeBuoy />
          </EmptyMedia>
          <EmptyTitle>Support is on its way</EmptyTitle>
          <EmptyDescription>
            Ticket-based support with live chat to your assigned WayTara advisor is coming to this page
            shortly.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
}
