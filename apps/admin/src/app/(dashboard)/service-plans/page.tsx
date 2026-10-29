import { CalendarCheck, ClipboardList, Wrench } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { ActionForm } from "@waytara/ui/action-form";
import { FormSubmit } from "@/components/form-submit";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, LoadError, PageHeader, StatCard, StatGrid } from "@/components/page-kit";
import { createServicePlan, updateServicePlan, createServiceContract } from "./actions";
import { ServicePlanDialog, type ServicePlanRow } from "./plan-dialog";

const inr = (v: number | null) => (v === null ? "—" : `₹${Number(v).toLocaleString("en-IN")}`);
const countOf = (v: unknown) => (Array.isArray(v) ? v.length : 0);

// AMC-style service plans: a template per device category that gets instantiated as a service_contracts row against one device. Individual visits
// are maintenance_tickets rows tagged with that contract's id (type = 'scheduled_service'), not tracked here.
export default async function ServicePlansPage() {
  const supabase = await createClient();

  const [{ data: planRows, error }, { data: devices }] = await Promise.all([
    supabase
      .from("service_plans")
      .select("id, name, device_category, duration_months, total_services_included, free_services_count, price_amount, per_extra_service_price_amount, covered_items, paid_extras")
      .order("name"),
    supabase.from("equipment").select("id, label, service_id, serial_number, device_type:equipment_inventory(name), site:sites(name)").is("parent_id", null).order("created_at", { ascending: false }),
  ]);
  const plans = (planRows ?? []) as ServicePlanRow[];
  const covered = (devices ?? []).filter((d) => d.service_id).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Service plans"
        description="AMC-style plans per device category. Attach one to a device as its active service contract; individual visits are tracked as maintenance tickets against that contract."
        actions={<ServicePlanDialog action={createServicePlan} />}
      />

      <StatGrid>
        <StatCard icon={ClipboardList} title="Plans" value={plans.length} detail={`${new Set(plans.map((p) => p.device_category)).size} device categories`} />
        <StatCard icon={Wrench} title="Devices under a plan" value={covered} detail={`${(devices?.length ?? 0) - covered} without a service contract`} tone="good" />
        <StatCard icon={CalendarCheck} title="Visits in plans" value={plans.reduce((n, p) => n + p.total_services_included, 0)} detail="Across all plans, as written" />
      </StatGrid>

      {error ? (
        <LoadError message={`Couldn't load the plans: ${error.message}`} />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          {plans.length === 0 ? (
            <EmptyState icon={Wrench} title="No service plans yet" description="Add one, then attach it to a device." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Visits</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Extra visit</TableHead>
                  <TableHead>Covers</TableHead>
                  <TableHead className="w-20">
                    <span className="sr-only">Edit</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.device_category.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-muted-foreground">{p.duration_months} months</TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.total_services_included}
                      {p.free_services_count > 0 ? <span className="text-xs"> ({p.free_services_count} free)</span> : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{inr(p.price_amount)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{inr(p.per_extra_service_price_amount)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {countOf(p.covered_items)} items{countOf(p.paid_extras) > 0 ? ` · ${countOf(p.paid_extras)} extras` : ""}
                    </TableCell>
                    <TableCell>
                      <ServicePlanDialog plan={p} action={updateServicePlan.bind(null, p.id)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Attach a plan to a device</CardTitle>
          <CardDescription>Re-attaching a device to a new plan replaces its active contract. The old one stays as history.</CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm action={createServiceContract} loading="Attaching…" success="Plan attached." className="flex flex-wrap items-end gap-3">
            <div className="grid gap-2">
              <Label>Device</Label>
              <Select name="deviceId" required>
                <SelectTrigger className="w-80">
                  <SelectValue placeholder="Choose a device" />
                </SelectTrigger>
                <SelectContent>
                  {(devices ?? []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.site?.name ?? "Site"}: {d.label || d.serial_number || d.device_type?.name || "Device"}
                      {d.service_id ? " (has a contract)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Plan</Label>
              <Select name="servicePlanId" required>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Choose a plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="startDate">Start date</Label>
              <Input id="startDate" name="startDate" type="date" required className="w-44" />
            </div>
            <FormSubmit pendingText="Attaching…">Attach</FormSubmit>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
