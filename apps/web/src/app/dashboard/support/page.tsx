import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { createClient } from "@waytara/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { NewSupportTicketDialog } from "@/components/dashboard/new-support-ticket-dialog";

const STATUS_BADGE_VARIANT: Record<string, "alert" | "default" | "secondary"> = {
  open: "alert",
  in_progress: "default",
  resolved: "secondary",
  closed: "secondary",
};

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: tickets } = profile
    ? await supabase
        .from("support_tickets")
        .select("id, subject, status, updated_at")
        .order("updated_at", { ascending: false })
    : { data: null };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-theme-primary">Support</h1>
          <p className="mt-1 text-sm text-theme-muted">Open a ticket and chat with your assigned WayTara advisor.</p>
        </div>
        <NewSupportTicketDialog error={error} />
      </div>

      {!tickets || tickets.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LifeBuoy />
            </EmptyMedia>
            <EmptyTitle>No support tickets yet</EmptyTitle>
            <EmptyDescription>Open one and your assigned advisor will pick it up here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ItemGroup className="divide-y divide-border rounded-xl border border-border">
          {tickets.map((t) => (
            <Item key={t.id} asChild size="sm">
              <Link href={`/dashboard/support/${t.id}`}>
                <ItemMedia variant="icon">
                  <LifeBuoy />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{t.subject}</ItemTitle>
                  <ItemDescription>Updated {new Date(t.updated_at).toLocaleDateString("en-IN")}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Badge variant={STATUS_BADGE_VARIANT[t.status] ?? "secondary"} className="capitalize">
                    {t.status.replace(/_/g, " ")}
                  </Badge>
                </ItemActions>
              </Link>
            </Item>
          ))}
        </ItemGroup>
      )}
    </div>
  );
}
