import { createClient } from "@waytara/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { rupees, type OfferAppliesTo, type OfferType, type TaxMode } from "@/lib/plan-pricing";
import { PlanEditor, type PlanData } from "./plan-editor";

// plans.code is a closed set (basic / pro / advance): this page edits the three existing tiers (their name, words, price, offer, GST and what they
// unlock), it does not create new ones. One tab per plan, with the form on the left and what the customer sees on the right.
export default async function PlansPage() {
  const supabase = await createClient();

  const { data } = await supabase.from("plans").select("*").order("price_monthly", { ascending: true });

  const plans: PlanData[] = (data ?? []).map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    tagline: p.tagline,
    badge: p.badge,
    highlights: Array.isArray(p.highlights) ? p.highlights.filter((h): h is string => typeof h === "string") : [],
    price_monthly: Number(p.price_monthly),
    price_yearly: p.price_yearly === null ? null : Number(p.price_yearly),
    max_devices: p.max_devices,
    is_active: p.is_active,
    features: (p.features as Record<string, boolean> | null) ?? {},
    tax_mode: p.tax_mode as TaxMode,
    gst_rate: Number(p.gst_rate),
    offer_enabled: p.offer_enabled,
    offer_label: p.offer_label,
    offer_type: p.offer_type as OfferType,
    offer_value: Number(p.offer_value),
    offer_applies_to: p.offer_applies_to as OfferAppliesTo,
    offer_valid_until: p.offer_valid_until,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Plans</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The three monitoring tiers: their names, prices, offers, GST and what each one unlocks. Changes apply at once to every customer on that plan.
        </p>
      </div>

      {plans.length === 0 ? (
        <p className="text-sm text-muted-foreground">No plans found.</p>
      ) : (
        <Tabs defaultValue={plans[0]!.id} className="gap-6">
          <TabsList className="h-auto flex-wrap justify-start">
            {plans.map((p) => (
              <TabsTrigger key={p.id} value={p.id} className="gap-2 px-4 py-2">
                <span className="font-medium">{p.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{rupees(p.price_monthly)}/mo</span>
                {p.offer_enabled ? <Badge className="px-1.5 py-0 text-[10px]">Offer</Badge> : null}
                {!p.is_active ? (
                  <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                    Hidden
                  </Badge>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
          {plans.map((p) => (
            <TabsContent key={p.id} value={p.id} className="mt-0">
              <PlanEditor plan={p} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
