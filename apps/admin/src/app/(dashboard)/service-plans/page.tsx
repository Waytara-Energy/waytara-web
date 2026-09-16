import { createClient } from "@waytara/supabase/server";
import { Input } from "@waytara/ui/input";
import { Button } from "@waytara/ui/button";
import { createServicePlan, updateServicePlan, createServiceContract } from "./actions";

interface ServicePlanRow {
  id: string;
  name: string;
  device_category: string;
  duration_months: number;
  total_services_included: number;
  free_services_count: number;
  price_amount: number | null;
  per_extra_service_price_amount: number | null;
  covered_items: unknown;
  paid_extras: unknown;
}

const inputClass = "h-9 w-full rounded-md border border-border bg-background px-2 text-sm";
const textareaClass = "min-h-16 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs font-mono";

function jsonToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return JSON.stringify(value, null, 2);
}

// AMC-style service plans — a template per device category ("like other
// companies do" for solar inverters vs. EV chargers) that gets
// instantiated as a service_contracts row against one device. Individual
// visits are maintenance_tickets rows tagged with that contract's id
// (type = 'scheduled_service'), not tracked here.
export default async function ServicePlansPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;
  const supabase = await createClient();

  const { data: plans } = await supabase
    .from("service_plans")
    .select(
      "id, name, device_category, duration_months, total_services_included, free_services_count, price_amount, per_extra_service_price_amount, covered_items, paid_extras"
    )
    .order("name");

  const { data: devices } = await supabase
    .from("devices")
    .select("id, label, service_id, device_type:stock(name, serial_number), site:sites(name)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Service Plans</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          AMC-style plans per device category — attach one to a device as its active service contract. Individual
          visits are tracked as maintenance tickets against that contract.
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

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold">Add a service plan</h2>
        <form action={createServicePlan} className="space-y-3">
          <PlanFields />
          <Button type="submit" size="sm">
            Add
          </Button>
        </form>
      </div>

      <div className="space-y-4">
        {((plans ?? []) as ServicePlanRow[]).map((plan) => (
          <div key={plan.id} className="rounded-lg border border-border bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold">{plan.name}</h3>
            <form action={updateServicePlan.bind(null, plan.id)} className="space-y-3">
              <PlanFields defaults={plan} />
              <Button type="submit" variant="outline" size="sm">
                Save
              </Button>
            </form>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold">Attach a plan to a device</h2>
        <form action={createServiceContract} className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Device</label>
            <select name="deviceId" className={inputClass + " w-64"} required defaultValue="">
              <option value="" disabled>
                Select…
              </option>
              {(devices ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.site?.name ?? "Site"} — {d.label || d.device_type?.serial_number || d.device_type?.name || "Device"}
                  {d.service_id ? " (has a contract)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Plan</label>
            <select name="servicePlanId" className={inputClass + " w-56"} required defaultValue="">
              <option value="" disabled>
                Select…
              </option>
              {(plans ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Start date</label>
            <Input name="startDate" type="date" className="h-9 w-40" required />
          </div>
          <Button type="submit" size="sm">
            Attach
          </Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          Re-attaching a device to a new plan replaces its active contract — the old one stays as history.
        </p>
      </div>
    </div>
  );
}

function PlanFields({ defaults }: { defaults?: ServicePlanRow }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Field label="Name" name="name" required defaultValue={defaults?.name} />
      <Field label="Device category" name="deviceCategory" required placeholder="e.g. solar_inverter" defaultValue={defaults?.device_category} />
      <Field label="Duration (months)" name="durationMonths" type="number" required defaultValue={defaults?.duration_months} />
      <Field label="Total services included" name="totalServicesIncluded" type="number" required defaultValue={defaults?.total_services_included} />
      <Field label="Free services" name="freeServicesCount" type="number" defaultValue={defaults?.free_services_count ?? 0} />
      <Field label="Plan price" name="priceAmount" type="number" defaultValue={defaults?.price_amount ?? ""} />
      <Field label="Per extra visit price" name="perExtraServicePriceAmount" type="number" defaultValue={defaults?.per_extra_service_price_amount ?? ""} />
      <div className="space-y-1.5 sm:col-span-2">
        <label className="text-xs font-medium text-muted-foreground">Covered items (JSON)</label>
        <textarea name="coveredItems" className={textareaClass} defaultValue={jsonToText(defaults?.covered_items)} placeholder='["annual health check","firmware update"]' />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <label className="text-xs font-medium text-muted-foreground">Paid extras (JSON)</label>
        <textarea name="paidExtras" className={textareaClass} defaultValue={jsonToText(defaults?.paid_extras)} placeholder='["panel deep-clean","part replacement"]' />
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Input name={name} type={type} required={required} placeholder={placeholder} defaultValue={defaultValue} className={inputClass} />
    </div>
  );
}
