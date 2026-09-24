import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { PresetsTable, type PresetRow, type SampleDevice } from "./presets-table";

// setting_presets rows the customer dashboard's Time-of-Use tab (and any
// future preset-driven tab) picks from — a named, pre-vetted bundle of
// writes rather than raw per-field editing. See tou-preset-picker.tsx on
// the web app for the consumer.
export default async function SettingPresetsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;
  const supabase = await createClient();

  const [{ data: presetRows }, { data: deviceRows }] = await Promise.all([
    supabase
      .from("setting_presets")
      .select("key, name, description, device_category, values, is_active")
      .order("device_category")
      .order("key"),
    // Sample devices for the preview picker — stock.category happens to be
    // the same machine-token string as instrument_catalog.device_category
    // for every currently-monitored category (solar_inverter, ev_charger),
    // so an exact match on the client side is enough to offer the right
    // devices for whichever preset is open.
    supabase
      .from("devices")
      .select("id, label, stock:stock_device_id(category, model_number, name)")
      .order("label"),
  ]);

  const sampleDevices: SampleDevice[] = (deviceRows ?? []).map((d) => ({
    id: d.id,
    label: d.label ?? d.stock?.name ?? d.stock?.model_number ?? "Unlabeled device",
    category: d.stock?.category ?? "",
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/devices" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Back to Stock Catalog
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Setting Presets</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pre-vetted bundles of writes the customer dashboard offers instead of raw field editing — e.g. the Time-of-Use
          tab&apos;s templates. Only presets marked Active are shown to customers.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
      )}
      {success && <div className="rounded-lg border border-border bg-primary/10 p-4 text-sm text-primary">Saved.</div>}

      <PresetsTable presets={(presetRows ?? []) as PresetRow[]} devices={sampleDevices} />
    </div>
  );
}
