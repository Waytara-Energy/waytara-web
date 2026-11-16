import { ActionForm } from "@waytara/ui/action-form";
import { ONBOARDING_LIMITS } from "@waytara/supabase/partner-onboarding";
import { FormSubmit } from "@/components/form-submit";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loadPartnerData, requirePartner } from "@/lib/partner-context";
import { savePartnerProfile } from "./actions";

export const dynamic = "force-dynamic";

function Field({ id, label, children, className }: { id: string; label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`grid gap-2 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

/** The partner's own profile: contact, business and team. Where they work and their past work stay as they sent them (shown, not edited, here). */
export default async function PartnerProfilePage() {
  const { application } = await requirePartner();
  const { data } = await loadPartnerData(application.id);
  const b = data.business;
  const rows = Math.min(ONBOARDING_LIMITS.members, Math.max(3, data.team.members.length + 1));
  // keyed by what is saved, so the fields show the saved values after a save
  const saved = `${application.contact_name}|${application.phone}|${JSON.stringify(data.business)}|${JSON.stringify(data.team)}`;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile and team</h1>
        <p className="mt-1 text-sm text-muted-foreground">Keep this up to date. Our team sees it when they plan work and check your details.</p>
      </div>

      <ActionForm key={saved} action={savePartnerProfile} loading="Saving…" success="Saved." className="space-y-8">
        <section className="space-y-4">
          <h2 className="text-sm font-semibold">You</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="contactName" label="Your name">
              <Input id="contactName" name="contactName" defaultValue={application.contact_name} required maxLength={200} autoComplete="name" />
            </Field>
            <Field id="phone" label="Phone">
              <Input id="phone" name="phone" type="tel" defaultValue={application.phone} required maxLength={32} autoComplete="tel" />
            </Field>
            <Field id="email" label="Sign-in e-mail" className="sm:col-span-2">
              <Input id="email" value={application.email} readOnly disabled />
              <p className="text-xs text-muted-foreground">To change your e-mail address, write to us under Support.</p>
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
          <p className="pt-2 text-xs font-medium text-muted-foreground">Key people (leave a row empty to remove it)</p>
          <div className="space-y-3">
            {Array.from({ length: rows }, (_, i) => {
              const m = data.team.members[i];
              return (
                <div key={i} className="grid gap-2 sm:grid-cols-3">
                  <Input name={`member_name_${i}`} defaultValue={m?.name ?? ""} placeholder="Name" aria-label={`Person ${i + 1}: name`} maxLength={120} />
                  <Input name={`member_role_${i}`} defaultValue={m?.role ?? ""} placeholder="Role" aria-label={`Person ${i + 1}: role`} maxLength={80} />
                  <Input name={`member_cert_${i}`} defaultValue={m?.certificate ?? ""} placeholder="Licence or certificate number" aria-label={`Person ${i + 1}: certificate`} maxLength={120} />
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">After saving, an empty row appears for the next person (up to {ONBOARDING_LIMITS.members}).</p>
        </section>

        <FormSubmit pendingText="Saving…">Save</FormSubmit>
      </ActionForm>

      <section className="space-y-2 border-t border-border pt-6">
        <h2 className="text-sm font-semibold">Where you work</h2>
        <p className="text-sm text-muted-foreground">{data.areas.districts.length > 0 ? data.areas.districts.join(", ") : "Not listed."}</p>
        <p className="text-xs text-muted-foreground">To change the places you cover, write to us under Support.</p>
      </section>
    </div>
  );
}
