import { Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { serviceDate } from "./maintenance-service";

export interface TicketRow {
  id: string;
  description: string | null;
  status: string;
  type: string;
  created_at: string;
  scheduled_date: string | null;
  completed_at: string | null;
}

/** What a status is called to a customer. */
export const STATUS_LABEL: Record<string, string> = { open: "Received", in_progress: "In progress", resolved: "Resolved", closed: "Closed" };
const STATUS_VARIANT: Record<string, "alert" | "default" | "secondary"> = { open: "alert", in_progress: "default", resolved: "secondary", closed: "secondary" };
export const isOpen = (status: string) => status === "open" || status === "in_progress";

/** The Requests tab: what the customer reported (and the service visits booked for them), newest first, with where each one stands. */
export function MaintenanceRequests({ tickets }: { tickets: TicketRow[] }) {
  if (tickets.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Wrench />
          </EmptyMedia>
          <EmptyTitle>No requests yet</EmptyTitle>
          <EmptyDescription>Report an issue and it shows up here, with its status.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Request</TableHead>
            <TableHead>Reported</TableHead>
            <TableHead>Visit</TableHead>
            <TableHead className="text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="max-w-[28rem] text-foreground">
                <p className="truncate">{t.description || (t.type === "scheduled_service" ? "Scheduled service" : "Issue reported")}</p>
                {t.type === "scheduled_service" && <p className="text-xs text-muted-foreground">Service visit</p>}
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{serviceDate(t.created_at)}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{serviceDate(t.completed_at ?? t.scheduled_date) ?? "—"}</TableCell>
              <TableCell className="text-right">
                <Badge variant={STATUS_VARIANT[t.status] ?? "secondary"}>{STATUS_LABEL[t.status] ?? t.status.replace(/_/g, " ")}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
