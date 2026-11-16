import { ActionForm } from "@waytara/ui/action-form";
import { LICENCE_TYPES, ONBOARDING_LIMITS } from "@waytara/supabase/partner-onboarding";
import { licenceStatus, todayIst } from "@waytara/supabase/partner-account";
import { FormSubmit } from "@/components/form-submit";
import { Input } from "@/components/ui/input";
import { loadPartnerData, requirePartner } from "@/lib/partner-context";
import { DocumentUploader } from "./document-uploader";
import { saveLicences } from "./actions";

export const dynamic = "force-dynamic";

/** Licences (with when each runs out, and a reminder from 60 days before) and the documents the partner has sent. */
export default async function PartnerLicencesPage() {
  const { application } = await requirePartner();
  const { data, documents } = await loadPartnerData(application.id);
  const today = todayIst();
  const rows = Math.min(ONBOARDING_LIMITS.licences, data.licences.length + 1);
  const saved = JSON.stringify(data.licences);

  return (
    <div className="max-w-3xl space-y-10">
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Licences and documents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            List each licence and when it is valid until, and we will remind you here from 60 days before it runs out. When you renew, change the date and send the new document. If you change which licence it is, our team checks it again.
          </p>
        </div>

        <ActionForm key={saved} action={saveLicences} loading="Saving…" success="Licences saved." className="space-y-4">
          {Array.from({ length: rows }, (_, i) => {
            const l = data.licences[i];
            const s = l ? licenceStatus(l.validUntil, today) : null;
            return (
              <div key={i} className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-[1.6fr_1fr_1fr_1fr]">
                <select name={`type_${i}`} defaultValue={l?.type ?? ""} aria-label={`Licence ${i + 1}: kind`} className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="">{l ? "Kind…" : "Add another licence…"}</option>
                  {LICENCE_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <Input name={`number_${i}`} defaultValue={l?.number ?? ""} placeholder="Number" aria-label={`Licence ${i + 1}: number`} maxLength={60} />
                <Input name={`grade_${i}`} defaultValue={l?.grade ?? ""} placeholder="Class or grade" aria-label={`Licence ${i + 1}: class or grade`} maxLength={60} />
                <Input name={`valid_${i}`} type="date" defaultValue={l?.validUntil ?? ""} aria-label={`Licence ${i + 1}: valid until`} />
                {s && s.state !== "none" && (
                  <p className={`text-xs sm:col-span-4 ${s.state === "expired" ? "font-medium text-destructive" : s.state === "soon" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                    {s.state === "expired" ? `Expired ${Math.abs(s.days ?? 0)} day${Math.abs(s.days ?? 0) === 1 ? "" : "s"} ago. Renew it and send the new document.` : s.state === "soon" ? `Runs out in ${s.days} day${s.days === 1 ? "" : "s"}. Time to renew.` : `Valid for ${s.days} more days.`}
                  </p>
                )}
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">Leave a row empty to remove it. After saving, an empty row appears for the next one (up to {ONBOARDING_LIMITS.licences}).</p>
          <FormSubmit pendingText="Saving…">Save licences</FormSubmit>
        </ActionForm>
      </section>

      <section className="space-y-4 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Documents</h2>
          <p className="mt-1 text-sm text-muted-foreground">Our team uses these only to verify you, and shares them with no one outside WayTara. You can send a new one or take one back; you cannot open a sent file again from here.</p>
        </div>
        <DocumentUploader items={documents.map((d) => ({ id: d.id, kind: d.kind, name: d.file_name, size: d.size_bytes, uploadedAt: d.uploaded_at }))} />
      </section>
    </div>
  );
}
