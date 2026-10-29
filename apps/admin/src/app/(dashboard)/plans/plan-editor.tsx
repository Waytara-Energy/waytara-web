"use client";

import * as React from "react";
import { Check, Info, RotateCcw, Sparkles, Tag } from "lucide-react";
import { ActionForm } from "@waytara/ui/action-form";
import { cn } from "@/lib/utils";
import { priceWithOfferAndTax, rupees, yearlySavingPct, type OfferAppliesTo, type OfferType, type PricingResult, type TaxMode } from "@/lib/plan-pricing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FormSubmit } from "@/components/form-submit";
import { updatePlan } from "./actions";

export interface PlanData {
  id: string;
  code: string;
  name: string;
  tagline: string | null;
  badge: string | null;
  highlights: string[];
  price_monthly: number;
  price_yearly: number | null;
  max_devices: number | null;
  is_active: boolean;
  features: Record<string, boolean>;
  tax_mode: TaxMode;
  gst_rate: number;
  offer_enabled: boolean;
  offer_label: string | null;
  offer_type: OfferType;
  offer_value: number;
  offer_applies_to: OfferAppliesTo;
  offer_valid_until: string | null;
}

/** The dashboard modules a plan can switch on. The keys are what the customer dashboard checks (plans.features). */
const FEATURES: { key: string; label: string; description: string }[] = [
  { key: "monitoring", label: "Monitoring", description: "Live readings and the device pages." },
  { key: "performance", label: "Performance", description: "Charts of how the system performed over time." },
  { key: "analytics", label: "Analytics", description: "Cost, savings and comparison figures." },
  { key: "reports", label: "Reports", description: "Reports and downloads (CSV, PDF)." },
  { key: "instrument_settings", label: "Instrument settings", description: "Change the device's settings from the dashboard." },
];

/** Everything the form edits, as text where the form is text (so a half-typed number stays as typed). */
interface Draft {
  name: string;
  tagline: string;
  badge: string;
  highlights: string;
  isActive: boolean;
  priceMonthly: string;
  priceYearly: string;
  offerEnabled: boolean;
  offerLabel: string;
  offerType: OfferType;
  offerValue: string;
  offerAppliesTo: OfferAppliesTo;
  offerValidUntil: string;
  taxMode: TaxMode;
  gstRate: string;
  unlimitedDevices: boolean;
  maxDevices: string;
  features: Record<string, boolean>;
}

function toDraft(p: PlanData): Draft {
  return {
    name: p.name,
    tagline: p.tagline ?? "",
    badge: p.badge ?? "",
    highlights: p.highlights.join("\n"),
    isActive: p.is_active,
    priceMonthly: String(p.price_monthly),
    priceYearly: p.price_yearly === null ? "" : String(p.price_yearly),
    offerEnabled: p.offer_enabled,
    offerLabel: p.offer_label ?? "",
    offerType: p.offer_type,
    offerValue: p.offer_value ? String(p.offer_value) : "",
    offerAppliesTo: p.offer_applies_to,
    offerValidUntil: p.offer_valid_until ?? "",
    taxMode: p.tax_mode,
    gstRate: String(p.gst_rate),
    unlimitedDevices: p.max_devices === null,
    maxDevices: p.max_devices === null ? "" : String(p.max_devices),
    features: Object.fromEntries(FEATURES.map((f) => [f.key, p.features?.[f.key] === true])),
  };
}

const num = (s: string): number | null => {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

function Field({ label, htmlFor, hint, className, children }: { label: string; htmlFor?: string; hint?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function MoneyInput({ id, name, value, onChange, placeholder, required }: { id: string; name: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
      <Input id={id} name={name} type="number" inputMode="decimal" min={0} step="any" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} className="pl-7" />
    </div>
  );
}

function SwitchRow({ id, name, checked, onChange, title, description }: { id: string; name: string; checked: boolean; onChange: (v: boolean) => void; title: string; description?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="grid gap-0.5">
        <Label htmlFor={id} className="cursor-pointer">
          {title}
        </Label>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <Switch id={id} name={name} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** One price as the customer would see it: the list price struck through when an offer applies, what they pay, and the GST line. */
function PriceLine({ label, result, taxMode, gstRate }: { label: string; result: PricingResult | null; taxMode: TaxMode; gstRate: number }) {
  if (!result) {
    return (
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">—</span>
      </div>
    );
  }
  const gstText =
    taxMode === "none" ? "No GST" : taxMode === "included" ? `includes ${rupees(result.gst)} GST (${gstRate}%)` : `+ ${rupees(result.gst)} GST (${gstRate}%)`;
  return (
    <div className="grid gap-0.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="flex items-baseline gap-2">
          {result.discount > 0 ? <span className="text-sm text-muted-foreground line-through tabular-nums">{rupees(result.list)}</span> : null}
          <span className="text-xl font-semibold tabular-nums">{rupees(result.total)}</span>
        </span>
      </div>
      <p className="text-right text-xs text-muted-foreground">
        {taxMode === "excluded" ? `${rupees(result.net)} ${gstText}` : gstText}
      </p>
    </div>
  );
}

export function PlanEditor({ plan }: { plan: PlanData }) {
  const initial = React.useMemo(() => toDraft(plan), [plan]);
  const [draft, setDraft] = React.useState<Draft>(initial);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  const monthly = num(draft.priceMonthly);
  const yearly = num(draft.priceYearly);
  const offerValue = num(draft.offerValue) ?? 0;
  const gstRate = num(draft.gstRate) ?? 18;
  const base = {
    offerEnabled: draft.offerEnabled,
    offerType: draft.offerType,
    offerValue,
    taxMode: draft.taxMode,
    gstRate,
  };
  const monthlyResult = priceWithOfferAndTax({ ...base, price: monthly, offerApplies: draft.offerAppliesTo !== "yearly" });
  const yearlyResult = yearly === null ? null : priceWithOfferAndTax({ ...base, price: yearly, offerApplies: draft.offerAppliesTo !== "monthly" });
  const saving = yearlySavingPct(monthly, yearly);
  const offerOn = draft.offerEnabled && offerValue > 0;
  const highlightList = draft.highlights.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const enabledFeatures = FEATURES.filter((f) => draft.features[f.key]);

  return (
    <ActionForm action={updatePlan.bind(null, plan.id)} loading={`Saving ${draft.name || plan.name}…`} success={`${draft.name || plan.name} saved.`} className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="grid gap-6">
        {/* ---- the plan itself */}
        <Card>
          <CardHeader>
            <CardTitle>Plan details</CardTitle>
            <CardDescription>The name and the words customers read about this plan.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Plan name" htmlFor={`${plan.id}-name`} hint={`Internal code: ${plan.code} (it never changes).`}>
                <Input id={`${plan.id}-name`} name="name" value={draft.name} onChange={(e) => set({ name: e.target.value })} maxLength={40} required />
              </Field>
              <Field label="Ribbon (optional)" htmlFor={`${plan.id}-badge`} hint="A small label on the plan, like “Most popular”.">
                <Input id={`${plan.id}-badge`} name="badge" value={draft.badge} onChange={(e) => set({ badge: e.target.value })} maxLength={24} placeholder="Most popular" />
              </Field>
            </div>
            <Field label="Tagline (optional)" htmlFor={`${plan.id}-tagline`}>
              <Input id={`${plan.id}-tagline`} name="tagline" value={draft.tagline} onChange={(e) => set({ tagline: e.target.value })} maxLength={90} placeholder="For homes that want the full picture" />
            </Field>
            <Field label="Highlights (optional)" htmlFor={`${plan.id}-highlights`} hint="One bullet point per line, up to 10.">
              <Textarea id={`${plan.id}-highlights`} name="highlights" value={draft.highlights} onChange={(e) => set({ highlights: e.target.value })} rows={4} placeholder={"Live inverter readings\nEmail alerts when something stops"} />
            </Field>
            <Separator />
            <SwitchRow
              id={`${plan.id}-active`}
              name="isActive"
              checked={draft.isActive}
              onChange={(v) => set({ isActive: v })}
              title="Active"
              description="On: new customers can be put on this plan. Off: hidden from new customers; customers already on it keep it."
            />
          </CardContent>
        </Card>

        {/* ---- price and offer */}
        <Card>
          <CardHeader>
            <CardTitle>Price and offer</CardTitle>
            <CardDescription>The list price, and an optional offer that takes money off it.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Monthly price" htmlFor={`${plan.id}-monthly`}>
                <MoneyInput id={`${plan.id}-monthly`} name="priceMonthly" value={draft.priceMonthly} onChange={(v) => set({ priceMonthly: v })} required />
              </Field>
              <Field label="Yearly price (optional)" htmlFor={`${plan.id}-yearly`} hint={saving ? `Saves ${saving}% compared with 12 monthly payments.` : "Leave empty if there is no yearly price."}>
                <MoneyInput id={`${plan.id}-yearly`} name="priceYearly" value={draft.priceYearly} onChange={(v) => set({ priceYearly: v })} />
              </Field>
            </div>

            <Separator />

            <SwitchRow
              id={`${plan.id}-offer`}
              name="offerEnabled"
              checked={draft.offerEnabled}
              onChange={(v) => set({ offerEnabled: v })}
              title="Run an offer on this plan"
              description="Shows the discounted price, with the list price struck through."
            />
            <div className={cn("grid gap-5 sm:grid-cols-2", !draft.offerEnabled && "opacity-50")}>
              <Field label="Offer name" htmlFor={`${plan.id}-offer-label`} hint="Shown next to the price, like “Festive offer”.">
                <Input id={`${plan.id}-offer-label`} name="offerLabel" value={draft.offerLabel} onChange={(e) => set({ offerLabel: e.target.value })} maxLength={40} placeholder="Festive offer" />
              </Field>
              <Field label="Valid until (optional)" htmlFor={`${plan.id}-offer-until`} hint="Empty = no end date.">
                <Input id={`${plan.id}-offer-until`} name="offerValidUntil" type="date" value={draft.offerValidUntil} onChange={(e) => set({ offerValidUntil: e.target.value })} />
              </Field>
              <Field label="Discount type">
                <Select name="offerType" value={draft.offerType} onValueChange={(v) => set({ offerType: v as OfferType })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percent off (%)</SelectItem>
                    <SelectItem value="flat">Flat amount off (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={draft.offerType === "percent" ? "Discount (%)" : "Discount (₹)"} htmlFor={`${plan.id}-offer-value`}>
                <Input id={`${plan.id}-offer-value`} name="offerValue" type="number" inputMode="decimal" min={0} max={draft.offerType === "percent" ? 100 : undefined} step="any" value={draft.offerValue} onChange={(e) => set({ offerValue: e.target.value })} placeholder={draft.offerType === "percent" ? "20" : "200"} />
              </Field>
              <Field label="Applies to" className="sm:col-span-2">
                <Select name="offerAppliesTo" value={draft.offerAppliesTo} onValueChange={(v) => set({ offerAppliesTo: v as OfferAppliesTo })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Monthly and yearly price</SelectItem>
                    <SelectItem value="monthly">Monthly price only</SelectItem>
                    <SelectItem value="yearly">Yearly price only</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </CardContent>
        </Card>

        {/* ---- GST */}
        <Card>
          <CardHeader>
            <CardTitle>GST and taxes</CardTitle>
            <CardDescription>How GST relates to the price you entered.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <Field label="GST on this plan">
              <Select name="taxMode" value={draft.taxMode} onValueChange={(v) => set({ taxMode: v as TaxMode })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="excluded">GST added on top of the price</SelectItem>
                  <SelectItem value="included">Price already includes GST</SelectItem>
                  <SelectItem value="none">No GST on this plan</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="GST rate (%)" htmlFor={`${plan.id}-gst`}>
              <Input id={`${plan.id}-gst`} name="gstRate" type="number" inputMode="decimal" min={0} max={100} step="any" value={draft.gstRate} onChange={(e) => set({ gstRate: e.target.value })} disabled={draft.taxMode === "none"} />
            </Field>
            <p className="flex items-start gap-2 text-xs text-muted-foreground sm:col-span-2">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              {draft.taxMode === "included"
                ? "The price you enter is what the customer pays; the GST part is shown inside it."
                : draft.taxMode === "excluded"
                  ? "The customer pays the price plus GST at this rate."
                  : "No GST is added or shown for this plan."}
            </p>
          </CardContent>
        </Card>

        {/* ---- access */}
        <Card>
          <CardHeader>
            <CardTitle>Access</CardTitle>
            <CardDescription>How many devices the plan covers, and which dashboard modules it unlocks. Changes apply to every customer on the plan at once.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
              <SwitchRow id={`${plan.id}-unlimited`} name="unlimitedDevices" checked={draft.unlimitedDevices} onChange={(v) => set({ unlimitedDevices: v })} title="Unlimited devices" />
              <Field label="Max devices" htmlFor={`${plan.id}-max`}>
                <Input id={`${plan.id}-max`} name="maxDevices" type="number" min={1} step={1} value={draft.maxDevices} onChange={(e) => set({ maxDevices: e.target.value })} disabled={draft.unlimitedDevices} placeholder={draft.unlimitedDevices ? "Unlimited" : "3"} />
              </Field>
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Dashboard modules</p>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="xs" onClick={() => set({ features: Object.fromEntries(FEATURES.map((f) => [f.key, true])) })}>
                  Select all
                </Button>
                <Button type="button" variant="ghost" size="xs" onClick={() => set({ features: Object.fromEntries(FEATURES.map((f) => [f.key, false])) })}>
                  Clear
                </Button>
              </div>
            </div>
            <div className="grid gap-4">
              {FEATURES.map((f) => (
                <SwitchRow
                  key={f.key}
                  id={`${plan.id}-f-${f.key}`}
                  name={`feature_${f.key}`}
                  checked={draft.features[f.key] === true}
                  onChange={(v) => set({ features: { ...draft.features, [f.key]: v } })}
                  title={f.label}
                  description={f.description}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ---- what the customer sees, and the save button */}
      <div className="grid gap-4 xl:sticky xl:top-4">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg">{draft.name || "Unnamed plan"}</CardTitle>
              {draft.badge ? (
                <Badge>
                  <Sparkles className="mr-1 size-3" />
                  {draft.badge}
                </Badge>
              ) : null}
              <Badge variant={draft.isActive ? "secondary" : "outline"} className="ml-auto">
                {draft.isActive ? "Active" : "Hidden"}
              </Badge>
            </div>
            <CardDescription>{draft.tagline || "No tagline"}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {offerOn ? (
              <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                <Tag className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate font-medium">{draft.offerLabel || "Offer"}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {draft.offerType === "percent" ? `${offerValue}% off` : `${rupees(offerValue)} off`}
                  {draft.offerValidUntil ? ` · until ${formatDate(draft.offerValidUntil)}` : ""}
                </span>
              </div>
            ) : null}
            <PriceLine label="Monthly" result={monthlyResult} taxMode={draft.taxMode} gstRate={gstRate} />
            <PriceLine label="Yearly" result={yearlyResult} taxMode={draft.taxMode} gstRate={gstRate} />
            <Separator />
            <p className="text-sm text-muted-foreground">{draft.unlimitedDevices ? "Unlimited devices" : `Up to ${draft.maxDevices || "—"} devices`}</p>
            <ul className="grid gap-1.5 text-sm">
              {enabledFeatures.length === 0 ? <li className="text-muted-foreground">No dashboard modules switched on.</li> : null}
              {enabledFeatures.map((f) => (
                <li key={f.key} className="flex items-center gap-2">
                  <Check className="size-4 shrink-0 text-primary" />
                  {f.label}
                </li>
              ))}
              {highlightList.map((h) => (
                <li key={h} className="flex items-center gap-2 text-muted-foreground">
                  <Check className="size-4 shrink-0" />
                  {h}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="flex items-center gap-2">
          <FormSubmit disabled={!dirty} className="flex-1" pendingText="Saving…">
            Save changes
          </FormSubmit>
          <Button type="button" variant="outline" disabled={!dirty} onClick={() => setDraft(initial)}>
            <RotateCcw />
            Reset
          </Button>
        </div>
        {dirty ? <p className="text-center text-xs text-muted-foreground">You have changes that are not saved yet.</p> : null}
      </div>
    </ActionForm>
  );
}
