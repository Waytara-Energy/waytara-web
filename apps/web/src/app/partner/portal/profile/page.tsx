import { redirect } from "next/navigation";
import { ActionForm } from "@waytara/ui/action-form";
import { ONBOARDING_LIMITS } from "@waytara/supabase/partner-onboarding";
import { NotYet } from "@/components/partner/not-yet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { DistrictsField } from "@/components/partner/districts-field";
import { findSessionRecord } from "@/lib/partner-track-server";
import { loadOnboarding } from "@/lib/partner-onboarding-server";
import { savePartnerProfile } from "../actions";

export const dynamic = "force-dynamic";

function Field({ id, label, children, className }: { id: string; label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

/** The partner's own profile: contact, business and team. Where they work stays as they sent it (shown here, changed through Support). */
export default async function PartnerProfilePage() {
  const app = await findSessionRecord();
  if (!app) redirect("/login");
  if (app.status !== "approved") return <NotYet what="Profile and team" />;
  const { data } = await loadOnboarding(app.id);
  const b = data.business;
  const rows = Math.min(ONBOARDING_LIMITS.members, Math.max(3, data.team.members.length + 1));
  // keyed by what is saved, so the fields show the saved values after a save (a form action resets its fields to their first values)
  const saved = `${app.contactName}|${app.phone}|${JSON.stringify(b)}|${JSON.stringify(data.team)}|${JSON.stringify(data.areas)}|${JSON.stringify(data.work)}`;

  return (
    <main className="fluid-container pb-20">
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <h1 className="text-[clamp(1.4rem,2.6vw,1.9rem)] font-semibold tracking-tight text-theme-primary">Profile and team</h1>
          <p className="mt-2 text-[15px] text-theme-secondary">Keep this up to date. Our team sees it when they plan work and check your details.</p>
        </div>

        <ActionForm key={saved} action={savePartnerProfile} loading="Saving…" success="Saved." className="space-y-9">
          <section className="space-y-4">
            <h2 className="text-sm font-semibold">You</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="contactName" label="Your name">
                <Input id="contactName" name="contactName" defaultValue={app.contactName} required maxLength={200} autoComplete="name" />
              </Field>
              <Field id="phone" label="Phone">
                <Input id="phone" name="phone" type="tel" defaultValue={app.phone} required maxLength={32} autoComplete="tel" />
              </Field>
              <Field id="email" label="Sign-in e-mail" className="sm:col-span-2">
                <Input id="email" value={app.email} readOnly disabled />
                <p className="text-xs text-theme-muted">To change your e-mail address, write to us under Support.</p>
              </Field>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold">Your business</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="businessName" label="Business name" className="sm:col-span-2">
                <Input id="businessName" name="businessName" defaultValue={b.name} required maxLength={200} autoComplete="organization" />
              </Field>
              <Field id="address" label="Address" className="sm:col-span-2">
                <Input id="address" name="address" defaultValue={b.address} maxLength={400} autoComplete="street-address" />
              </Field>
              <Field id="city" label="Town or city">
                <Input id="city" name="city" defaultValue={b.city} maxLength={100} />
              </Field>
              <Field id="pin" label="PIN code">
                <Input id="pin" name="pin" defaultValue={b.pin} inputMode="numeric" maxLength={6} />
              </Field>
              <Field id="gstin" label="GSTIN">
                <Input id="gstin" name="gstin" defaultValue={b.gstin} maxLength={15} />
              </Field>
              <Field id="website" label="Website">
                <Input id="website" name="website" defaultValue={b.website} maxLength={300} inputMode="url" />
              </Field>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold">Your team</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="teamSize" label="People who work with you">
                <Input id="teamSize" name="teamSize" defaultValue={data.team.size} inputMode="numeric" maxLength={6} />
              </Field>
              <Field id="teamCertified" label="Of them, holding a licence or certificate">
                <Input id="teamCertified" name="teamCertified" defaultValue={data.team.certified} inputMode="numeric" maxLength={6} />
              </Field>
            </div>
            <p className="pt-2 text-xs font-medium text-theme-muted">Key people (leave a row empty to remove it)</p>
            <div className="space-y-3">
              {Array.from({ length: rows }, (_, i) => {
                const m = data.team.members[i];
                return (
                  <div key={i} className="grid gap-2 sm:grid-cols-3">
                    {/* who this person is to the team that verifies them: kept across saves */}
                    <input type="hidden" name={`member_id_${i}`} value={m?.id ?? ""} />
                    <input type="hidden" name={`member_added_${i}`} value={m?.addedAt ?? ""} />
                    <Input name={`member_name_${i}`} defaultValue={m?.name ?? ""} placeholder="Name" aria-label={`Person ${i + 1}: name`} maxLength={120} />
                    <Input name={`member_role_${i}`} defaultValue={m?.role ?? ""} placeholder="Role" aria-label={`Person ${i + 1}: role`} maxLength={80} />
                    <Input name={`member_cert_${i}`} defaultValue={m?.certificate ?? ""} placeholder="Licence or certificate number" aria-label={`Person ${i + 1}: certificate`} maxLength={120} />
                    <label className="flex items-center gap-2 text-xs text-theme-muted sm:col-span-3">
                      <input type="checkbox" name={`member_needs_${i}`} value="yes" defaultChecked={m ? m.needsLicence : true} className="size-3.5" /> Needs a licence or certificate. Our team verifies a new person before they count as part of your team.
                    </label>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-theme-muted">After saving, an empty row appears for the next person (up to {ONBOARDING_LIMITS.members}).</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold">Where you work</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="districts" label="Districts and cities you can work in" className="sm:col-span-2">
                <DistrictsField id="districts" initial={data.areas.districts} />
              </Field>
              <Field id="capacity" label="Jobs you can take on in a month">
                <Input id="capacity" name="capacity" defaultValue={data.areas.capacity} inputMode="numeric" maxLength={6} />
              </Field>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold">Your past work</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="installs" label="Installations completed so far">
                <Input id="installs" name="installs" defaultValue={data.work.installs} inputMode="numeric" maxLength={6} />
              </Field>
              <Field id="largest" label="Largest system, in kW">
                <Input id="largest" name="largest" defaultValue={data.work.largest} inputMode="decimal" maxLength={8} />
              </Field>
              <Field id="summary" label="About the work you do" className="sm:col-span-2">
                <Textarea id="summary" name="summary" defaultValue={data.work.summary} rows={4} maxLength={1500} />
              </Field>
            </div>
            <p className="pt-2 text-xs font-medium text-theme-muted">Projects we can ask you about (leave a row empty to remove it)</p>
            <div className="space-y-3">
              {Array.from({ length: Math.min(ONBOARDING_LIMITS.projects, data.work.projects.length + 1) }, (_, i) => {
                const pr = data.work.projects[i];
                return (
                  <div key={i} className="grid gap-2 sm:grid-cols-[2fr_1.2fr_0.6fr_0.6fr]">
                    <Input name={`project_title_${i}`} defaultValue={pr?.title ?? ""} placeholder="What it was" aria-label={`Project ${i + 1}: what it was`} maxLength={120} />
                    <Input name={`project_place_${i}`} defaultValue={pr?.place ?? ""} placeholder="Where" aria-label={`Project ${i + 1}: where`} maxLength={120} />
                    <Input name={`project_size_${i}`} defaultValue={pr?.size ?? ""} placeholder="kW" aria-label={`Project ${i + 1}: kW`} inputMode="decimal" maxLength={8} />
                    <Input name={`project_year_${i}`} defaultValue={pr?.year ?? ""} placeholder="Year" aria-label={`Project ${i + 1}: year`} inputMode="numeric" maxLength={4} />
                    <Input name={`project_note_${i}`} defaultValue={pr?.note ?? ""} placeholder="Anything to add" aria-label={`Project ${i + 1}: note`} maxLength={400} className="sm:col-span-4" />
                  </div>
                );
              })}
            </div>
          </section>

          <SubmitButton pendingText="Saving…">Save</SubmitButton>
        </ActionForm>


      </div>
    </main>
  );
}
