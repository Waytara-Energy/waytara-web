import { getCurrentProfile } from "@waytara/supabase/auth";
import { createClient } from "@waytara/supabase/server";
import { SupportBoard } from "@/components/support-board";

// The row-level rules decide which tickets come back: an admin gets every ticket; an employee or a site engineer gets those of the sites they
// are assigned to (and, for older tickets with no site, of the customers they onboarded). No filter here.
export default async function SupportPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: tickets } = await supabase
    .from("support_tickets")
    .select("id, ticket_no, subject, status, customer_name, site_name, assigned_to, assigned_name, assigned_role, last_message_at, last_message_preview, last_message_role, unread_staff, created_at, updated_at, rating")
    .order("updated_at", { ascending: false })
    .limit(500);

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Support</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {profile?.role === "admin" ? "Every ticket, from every customer and site." : "Tickets from the sites you look after."} Take a ticket to answer it, or hand it to someone else on the team: the customer is e-mailed each time.
        </p>
      </div>
      <SupportBoard tickets={tickets ?? []} meId={profile?.id ?? ""} isAdmin={profile?.role === "admin"} />
    </div>
  );
}
