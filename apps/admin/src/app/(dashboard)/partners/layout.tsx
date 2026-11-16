import { Suspense } from "react";
import { createClient } from "@waytara/supabase/server";
import { PartnersBoard } from "@/components/partners-board";
import { PartnersFrame } from "@/components/partners-frame";

// Admin only (the proxy and the row-level rules both enforce it). The list stays on the left while an application is open on the right: this layout is not rebuilt
// when one is opened. The frame renders at once and the list fills in behind its own fallback.
export default function PartnersLayout({ children }: { children: React.ReactNode }) {
  return (
    <PartnersFrame
      list={
        <Suspense fallback={<div className="flex-1 rounded-xl border bg-card p-4 text-sm text-muted-foreground">Loading applications…</div>}>
          <Board />
        </Suspense>
      }
    >
      {children}
    </PartnersFrame>
  );
}

async function Board() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partner_applications")
    .select("id, company_name, contact_name, phone, email, status, partner_type, reference, created_at, updated_at, profile_id")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return <div className="flex-1 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">Couldn&apos;t load applications: {error.message}</div>;
  return <PartnersBoard partners={(data ?? []).map(({ profile_id, ...p }) => ({ ...p, has_account: Boolean(profile_id) }))} />;
}
