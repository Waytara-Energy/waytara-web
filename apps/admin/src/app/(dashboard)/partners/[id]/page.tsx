import Link from "next/link";
import { createClient } from "@waytara/supabase/server";
import { ActionForm } from "@waytara/ui/action-form";
import { Button } from "@waytara/ui/button";
import { ToneBadge, type Tone } from "@/components/page-kit";
import { PARTNER_SERVICE_LABEL, PARTNER_STATUSES, PARTNER_STATUS_LABEL } from "@/lib/partners";
import { reviewPartnerApplication } from "./actions";

const TONES: Record<string, Tone> = { new: "info", in_review: "warn", approved: "good", rejected: "neutral" };

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children || "—"}</dd>
    </div>
  );
}

export default async function PartnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: app, error } = await supabase
    .from("partner_applications")
    .select("*, reviewer:profiles!partner_applications_reviewed_by_fkey(full_name)")
    .eq("id", id)
    .single();

  if (error || !app) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Couldn&apos;t load this application.{error ? ` (${error.message})` : ""}
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/partners" className="text-xs text-muted-foreground hover:underline">
          ← Back to Partners
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{app.company_name}</h1>
          <ToneBadge tone={TONES[app.status] ?? "neutral"}>{PARTNER_STATUS_LABEL[app.status] ?? app.status}</ToneBadge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Received {new Date(app.created_at).toLocaleString("en-IN")}</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Contact</h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Item label="Contact person">{app.contact_name}</Item>
          <Item label="Phone">
            <a href={`tel:${app.phone}`} className="hover:underline">
              {app.phone}
            </a>
          </Item>
          <Item label="E-mail">
            <a href={`mailto:${app.email}`} className="hover:underline">
              {app.email}
            </a>
          </Item>
          <Item label="Website">{app.website}</Item>
        </dl>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Their work</h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Item label="Services">{app.services.map((s) => PARTNER_SERVICE_LABEL[s] ?? s).join(", ")}</Item>
          </div>
          <div className="sm:col-span-2">
            <Item label={`Works in (${app.states.length})`}>{app.states.join(", ")}</Item>
          </div>
          <div className="sm:col-span-2">
            <Item label="Cities or districts">{app.cities}</Item>
          </div>
          <Item label="Years in business">{app.years_in_business != null ? String(app.years_in_business) : ""}</Item>
          <Item label="Installations so far">{app.installs_completed}</Item>
          <Item label="Team size">{app.team_size}</Item>
          <Item label="Certifications or empanelments">{app.certifications}</Item>
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">Their message</dt>
            <dd className="whitespace-pre-wrap text-sm">{app.message ?? "—"}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Review</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {app.reviewed_at
            ? `Last updated by ${app.reviewer?.full_name ?? "an admin"} on ${new Date(app.reviewed_at).toLocaleString("en-IN")}.`
            : "Not reviewed yet."}
        </p>
        <ActionForm action={reviewPartnerApplication.bind(null, app.id)} loading="Saving…" success="Application updated." className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="status" className="text-sm font-medium">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={app.status}
              className="h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {PARTNER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PARTNER_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="adminNotes" className="text-sm font-medium">
              Notes <span className="font-normal text-muted-foreground">(only the admins see these)</span>
            </label>
            <textarea
              id="adminNotes"
              name="adminNotes"
              rows={5}
              maxLength={5000}
              defaultValue={app.admin_notes ?? ""}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <Button type="submit" size="sm">
            Save
          </Button>
        </ActionForm>
      </div>
    </div>
  );
}
