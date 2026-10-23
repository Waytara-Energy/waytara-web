import { Suspense } from "react";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { createClient } from "@waytara/supabase/server";
import { SupportBoard } from "@/components/support-board";
import { SupportFrame } from "@/components/support-frame";
import { InboxSkeleton } from "@/components/support-skeletons";

// The row-level rules decide which tickets come back: an admin gets every ticket; an employee or a site engineer gets those of the sites they
// are assigned to (and, for older tickets with no site, of the customers they onboarded). No filter here. The list stays on the left while a
// ticket is open on the right: this layout is not rebuilt when a ticket is opened. The frame renders at once and the list fills in behind its
// own skeleton.
export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return (
    <SupportFrame
      list={
        <Suspense fallback={<InboxSkeleton />}>
          <Board />
        </Suspense>
      }
    >
      {children}
    </SupportFrame>
  );
}

async function Board() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: tickets } = await supabase
    .from("support_tickets")
    .select("id, ticket_no, subject, status, customer_name, site_name, assigned_to, assigned_name, assigned_role, last_message_at, last_message_preview, last_message_role, unread_staff, created_at, updated_at, rating")
    .order("updated_at", { ascending: false })
    .limit(500);

  return <SupportBoard tickets={tickets ?? []} meId={profile?.id ?? ""} isAdmin={profile?.role === "admin"} />;
}
