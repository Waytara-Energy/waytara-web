"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { withPromiseToast } from "@waytara/ui/notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ButtonSpinner } from "@/components/ui/spinner";
import { INDIAN_STATES } from "@/lib/tariff";
import { addressLine, normaliseGstin, sameAddress, type Address } from "@/lib/address";
import { saveAddresses } from "@/app/dashboard/settings/actions";
import { FieldRow, SettingsCard, ToggleRow } from "./settings-card";

function AddressFields({ idPrefix, value, onChange }: { idPrefix: string; value: Address; onChange: (a: Address) => void }) {
  const set = (k: keyof Address) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <FieldRow label="House, building and street" htmlFor={`${idPrefix}-line1`}>
          <Input id={`${idPrefix}-line1`} value={value.line1} onChange={set("line1")} autoComplete="address-line1" maxLength={160} />
        </FieldRow>
      </div>
      <div className="sm:col-span-2">
        <FieldRow label="Area or landmark" htmlFor={`${idPrefix}-line2`} hint="Optional">
          <Input id={`${idPrefix}-line2`} value={value.line2} onChange={set("line2")} autoComplete="address-line2" maxLength={160} />
        </FieldRow>
      </div>
      <FieldRow label="City" htmlFor={`${idPrefix}-city`}>
        <Input id={`${idPrefix}-city`} value={value.city} onChange={set("city")} autoComplete="address-level2" maxLength={80} />
      </FieldRow>
      <FieldRow label="Pincode" htmlFor={`${idPrefix}-pincode`}>
        <Input id={`${idPrefix}-pincode`} value={value.pincode} onChange={(e) => onChange({ ...value, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })} inputMode="numeric" autoComplete="postal-code" placeholder="600001" />
      </FieldRow>
      <div className="sm:col-span-2">
        <FieldRow label="State" htmlFor={`${idPrefix}-state`}>
          <Select value={value.state} onValueChange={(state) => onChange({ ...value, state })}>
            <SelectTrigger id={`${idPrefix}-state`} aria-label="State">
              <SelectValue placeholder="Choose a state" />
            </SelectTrigger>
            <SelectContent>
              {INDIAN_STATES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>
      </div>
    </div>
  );
}

/** Settings > Addresses: the customer's own address, and the billing address (the same unless they say otherwise), with the e-mail and GST
 *  number that bills and statements use. */
export function AddressesSection({ address, billing, billingEmail, gstin }: { address: Address; billing: Address | null; billingEmail: string; gstin: string }) {
  const router = useRouter();
  const [addr, setAddr] = React.useState<Address>(address);
  const [same, setSame] = React.useState(billing === null || sameAddress(billing, address));
  const [bill, setBill] = React.useState<Address>(billing ?? address);
  const [email, setEmail] = React.useState(billingEmail);
  const [gst, setGst] = React.useState(gstin);
  const [saving, setSaving] = React.useState(false);
  const [initial, setInitial] = React.useState(() => JSON.stringify({ addr: address, same: billing === null || sameAddress(billing, address), bill: billing ?? address, email: billingEmail, gst: gstin }));
  const dirty = JSON.stringify({ addr, same, bill: same ? addr : bill, email, gst }) !== initial;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const ok = await withPromiseToast(saveAddresses, { loading: "Saving…", success: "Addresses saved." })({ address: addr, billing: same ? null : bill, billingEmail: email, gstin: gst });
    setSaving(false);
    if (ok) {
      setInitial(JSON.stringify({ addr, same, bill: same ? addr : bill, email, gst }));
      router.refresh();
    }
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <SettingsCard title="Your address" description="Where you live or run your business. Your site's location is managed on the Site page.">
        <AddressFields idPrefix="addr" value={addr} onChange={setAddr} />
      </SettingsCard>

      <SettingsCard title="Billing" description="What we put on bills and statements.">
        <ToggleRow title="Billing address is the same as my address" description={same ? addressLine(addr) || "Add your address above." : "Enter a different address below."}>
          <Switch checked={same} onCheckedChange={setSame} aria-label="Billing address is the same as my address" />
        </ToggleRow>
        {!same && <AddressFields idPrefix="bill" value={bill} onChange={setBill} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label="Billing e-mail" htmlFor="billingEmail" hint="Bills go here instead of your sign-in address. Optional.">
            <Input id="billingEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" placeholder="accounts@example.com" />
          </FieldRow>
          <FieldRow label="GST number" htmlFor="gstin" hint="Optional, 15 characters.">
            <Input id="gstin" value={gst} onChange={(e) => setGst(normaliseGstin(e.target.value).slice(0, 15))} autoComplete="off" placeholder="33AABCU9603R1ZX" className="uppercase" />
          </FieldRow>
        </div>
      </SettingsCard>

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!dirty || saving}>
          <ButtonSpinner show={saving} />
          {saving ? "Saving…" : "Save addresses"}
        </Button>
      </div>
    </form>
  );
}
