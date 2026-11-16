import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { LICENCE_TYPES } from "@waytara/supabase/partner-onboarding";
import { licenceStatus, todayIst } from "@waytara/supabase/partner-account";
import { loadPartnerData, requirePartner } from "@/lib/partner-context";
import { PARTNER_TYPE_LABEL } from "@/lib/partners";

export const dynamic = "force-dynamic";

/** The partner's home: who they are in the network, and any licence that has run out or is about to (60 days), which is the one thing worth their attention. */
export default async function PartnerHomePage() {
  const { application } = await requirePartner();
  const { data } = await loadPartnerData(application.id);
  const today = todayIst();
  const due = data.licences
    .map((l) => ({ l, s: licenceStatus(l.validUntil, today) }))
    .filter((x) => x.s.state === "expired" || x.s.state === "soon")
    .sort((a, b) => (a.s.days ?? 0) - (b.s.days ?? 0));
  const first = application.contact_name.trim().split(/\s+/)[0] || "there";

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">Hi {first}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Your partner area</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          {PARTNER_TYPE_LABEL[application.partner_type ?? ""] ?? "Partner"} in the WayTara Partner Network
          {application.reference ? `, reference ${application.reference}` : ""}. Keep your details and licences up to date here, and write to us if you need anything.
        </p>
      </div>

      {due.length > 0 ? (
        <section aria-labelledby="due-heading" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-5">
          <h2 id="due-heading" className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="size-4 text-amber-500" aria-hidden="true" /> Licences to renew
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {due.map(({ l, s }, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-x-4">
                <span>
                  {LICENCE_TYPES.find((t) => t.id === l.type)?.label ?? "Licence"} · {l.number || "no number"}
                </span>
                <span className={s.state === "expired" ? "font-medium text-destructive" : "text-muted-foreground"}>
                  {s.state === "expired" ? `Expired ${Math.abs(s.days ?? 0)} day${Math.abs(s.days ?? 0) === 1 ? "" : "s"} ago` : s.days === 0 ? "Runs out today" : `Runs out in ${s.days} day${s.days === 1 ? "" : "s"}`}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm">
            <Link href="/partner/licences" className="font-medium underline underline-offset-4">
              Update your licences and documents
            </Link>
          </p>
        </section>
      ) : (
        <section className="flex items-start gap-3 rounded-lg border border-border p-5 text-sm">
          <CheckCircle2 className="mt-0.5 size-4 text-emerald-600" aria-hidden="true" />
          <p className="text-muted-foreground">{data.licences.length > 0 ? "None of your licences runs out in the next 60 days." : "You have no licences listed yet. You can add them under Licences and documents."}</p>
        </section>
      )}

      <ul className="grid gap-3 sm:grid-cols-3">
        {[
          { href: "/partner/profile", title: "Profile and team", text: "Your business, contact and key people" },
          { href: "/partner/licences", title: "Licences and documents", text: "Renew a licence or send a document" },
          { href: "/partner/support", title: "Support", text: "Write to the partnerships team" },
        ].map((c) => (
          <li key={c.href}>
            <Link href={c.href} className="block h-full rounded-lg border border-border p-4 transition-colors hover:bg-accent">
              <span className="block text-sm font-medium">{c.title}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{c.text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
