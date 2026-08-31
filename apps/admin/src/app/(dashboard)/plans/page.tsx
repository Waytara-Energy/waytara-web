import { createClient } from "@waytara/supabase/server";
import { Input } from "@waytara/ui/input";
import { Button } from "@waytara/ui/button";
import { updatePlan } from "./actions";

const FEATURE_LABELS: Record<string, string> = {
  monitoring: "Monitoring",
  performance: "Performance",
  analytics: "Analytics",
  reports: "Reports",
  instrument_settings: "Instrument Settings",
};

// plans.code is a closed enum (basic/pro/advance) — this is an editor for
// the three existing tiers' pricing and feature gates, not a "create a
// plan" screen; the schema doesn't support arbitrary new codes.
export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;
  const supabase = await createClient();

  const { data: plans } = await supabase.from("plans").select("*").order("price_monthly", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Plans</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pricing and dashboard feature gates for the three monitoring tiers. Changes take effect
          immediately for every customer on that plan.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-border bg-primary/10 p-4 text-sm text-primary">Saved.</div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {(plans ?? []).map((plan) => {
          const features = (plan.features as Record<string, boolean>) ?? {};
          return (
            <form
              key={plan.id}
              action={updatePlan.bind(null, plan.id)}
              className="space-y-4 rounded-lg border border-border bg-card p-5"
            >
              <div>
                <h2 className="text-sm font-semibold capitalize">{plan.name}</h2>
                <p className="text-xs text-muted-foreground">code: {plan.code}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Monthly price (₹)</label>
                <Input type="number" name="priceMonthly" min={0} defaultValue={plan.price_monthly} className="h-9" required />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Yearly price (₹, optional)</label>
                <Input type="number" name="priceYearly" min={0} defaultValue={plan.price_yearly ?? ""} className="h-9" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Max devices (blank = unlimited)</label>
                <Input type="number" name="maxDevices" min={1} defaultValue={plan.max_devices ?? ""} className="h-9" />
              </div>

              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-xs font-medium text-muted-foreground">Dashboard features</p>
                {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name={`feature_${key}`} defaultChecked={features[key] ?? false} className="h-4 w-4" />
                    {label}
                  </label>
                ))}
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isActive" defaultChecked={plan.is_active} className="h-4 w-4" />
                Active (visible to new customers)
              </label>

              <Button type="submit" size="sm" className="w-full">
                Save {plan.name}
              </Button>
            </form>
          );
        })}
      </div>
    </div>
  );
}
