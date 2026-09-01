import Link from "next/link";
import { createClient } from "@waytara/supabase/server";
import { Button } from "@waytara/ui/button";
import { Input } from "@waytara/ui/input";
import { MonitoringPanel } from "@waytara/ui/monitoring-panel";
import { QuotationForm } from "./quotation-form";
import {
  recordQuotationAccepted,
  recordQuotationRejected,
  recordFullPayment,
  recordSplitPayment,
  resendCustomerInviteEmail,
  createSite,
  addDevice,
  completeSiteSetup,
  startTestSession,
  sendTestSignal,
  markDeviceVerified,
  completeConnectionTest,
  failTestSession,
  scheduleInstall,
  completeInstallation,
} from "./actions";

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  residential_independent_villas: "Residential & Independent Villas",
  gated_communities_rwas_high_rises: "Gated Communities, RWAs & High-Rises",
  factories_heavy_engineering_processing_plants: "Factories, Heavy Engineering & Processing Plants",
  corporate_offices_hospitals_hotels_retail: "Corporate Offices, Hospitals, Hotels & Retail",
  logistics_delivery_hubs_bus_depots: "Logistics, Delivery Hubs & Bus Depots",
  tech_parks_data_centers_rnd_hubs: "Tech Parks, Data Centers & R&D Hubs",
};

const POWER_SOURCE_LABELS: Record<string, string> = {
  grid_tied: "Grid Tied",
  off_grid: "Off Grid",
  hybrid: "Hybrid",
};

export default async function OnboardingPipelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error: actionError } = await searchParams;
  const supabase = await createClient();

  const { data: onboarding, error } = await supabase
    .from("customer_onboarding")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !onboarding) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Couldn&apos;t load this onboarding record. {error ? `(${error.message})` : ""}
      </div>
    );
  }

  const { data: lead } = await supabase
    .from("leads")
    .select("id, full_name, email, phone")
    .eq("id", onboarding.lead_id)
    .single();

  const { data: quotations } = await supabase
    .from("quotations")
    .select("*, plan:plans(name)")
    .eq("lead_id", onboarding.lead_id)
    .order("created_at", { ascending: false });

  const activeQuotation = quotations?.find((q) => q.status === "draft" || q.status === "sent");
  const acceptedQuotation = quotations?.find((q) => q.status === "accepted");
  const pastQuotations = quotations?.filter((q) => q !== activeQuotation) ?? [];

  const { data: plans } = await supabase
    .from("plans")
    .select("id, name, price_monthly")
    .eq("is_active", true)
    .order("price_monthly");

  // Not a `profiles` lookup: profiles_self_or_admin RLS only allows self or
  // admin, so an employee can't read an arbitrary customer's profile row
  // (confirmed live — the query came back empty for an employee session).
  // The lead record already has the same name/email and is RLS-visible to
  // the employee regardless, so use that instead of adding another policy
  // just to duplicate a value that's already on hand.

  // sites has no back-reference to customer_onboarding, so this takes the
  // customer's most recently created site as "this onboarding's site" —
  // fine for one system per onboarding (the common case); a customer with
  // two separate purchases/onboardings would need a real link to
  // disambiguate, which the schema doesn't have.
  let site: {
    id: string;
    name: string;
    property_type: string;
    power_source_category: string;
  } | null = null;
  let devices: {
    id: string;
    device_uid: string;
    label: string | null;
    status: string;
    installed_at: string | null;
    device_type: {
      name: string;
      device_type_instruments: { instrument_key: string; unit: string | null; is_required: boolean }[];
    } | null;
  }[] = [];
  let deviceTypes: {
    id: string;
    name: string;
    device_type_instruments: { instrument_name: string; unit: string | null; is_required: boolean }[];
  }[] = [];
  let testSession: {
    id: string;
    status: string;
    started_at: string;
    notes: string | null;
  } | null = null;

  const STAGES_NEEDING_SITE = ["site_setup", "connection_test", "install_scheduled", "install_completed"];

  if (STAGES_NEEDING_SITE.includes(onboarding.current_stage) && onboarding.customer_id) {
    const { data: siteRow } = await supabase
      .from("sites")
      .select("id, name, property_type, power_source_category")
      .eq("customer_id", onboarding.customer_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    site = siteRow;

    if (site) {
      const { data: deviceRows } = await supabase
        .from("devices")
        .select(
          "id, device_uid, label, status, installed_at, device_type:device_types(name, device_type_instruments(instrument_key, unit, is_required))"
        )
        .eq("site_id", site.id)
        .order("created_at", { ascending: false });
      devices = deviceRows ?? [];
    }

    if (onboarding.current_stage === "site_setup") {
      const { data: deviceTypeRows } = await supabase
        .from("device_types")
        .select("id, name, device_type_instruments(instrument_name, unit, is_required)")
        .order("name");
      deviceTypes = deviceTypeRows ?? [];
    }

    if (onboarding.current_stage === "connection_test" && site) {
      const { data: sessionRow } = await supabase
        .from("test_sessions")
        .select("id, status, started_at, notes")
        .eq("site_id", site.id)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      testSession = sessionRow;
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href={`/leads/${onboarding.lead_id}`} className="text-xs text-muted-foreground hover:underline">
          ← Back to Lead
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Onboarding — {lead?.full_name ?? "Unknown lead"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground capitalize">
          Stage: {onboarding.current_stage.replace(/_/g, " ")}
        </p>
      </div>

      {actionError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {onboarding.current_stage === "payment_pending" ? (
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold">Payment</h2>
            <p className="text-sm text-muted-foreground">
              {acceptedQuotation
                ? `Accepted quotation: ₹${Number(acceptedQuotation.total_amount).toLocaleString("en-IN")}`
                : "No accepted quotation found for this lead."}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Simulated — clicking Pay records the payment directly and moves
              straight to account creation. Real Razorpay checkout isn&apos;t
              wired up yet.
            </p>
          </div>

          {acceptedQuotation && (
            <div className="flex flex-col gap-4 border-t border-border pt-4 sm:flex-row">
              <form action={recordFullPayment.bind(null, onboarding.id, acceptedQuotation.id)}>
                <Button type="submit" size="sm">
                  Pay Full — ₹{Number(acceptedQuotation.total_amount).toLocaleString("en-IN")}
                </Button>
              </form>

              <form
                action={recordSplitPayment.bind(null, onboarding.id, acceptedQuotation.id)}
                className="flex items-center gap-2"
              >
                <Input
                  type="number"
                  name="advanceAmount"
                  placeholder="Advance amount"
                  min={1}
                  max={Number(acceptedQuotation.total_amount) - 1}
                  className="h-9 w-40"
                  required
                />
                <Button type="submit" variant="outline" size="sm">
                  Pay Advance (Split)
                </Button>
              </form>
            </div>
          )}
        </div>
      ) : onboarding.current_stage === "account_created" ? (
        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold">Account Creation</h2>
          {onboarding.customer_id ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                Profile submitted
              </span>
              <span className="text-muted-foreground">
                {lead?.full_name ?? lead?.email ?? "Customer"} finished
                setting up their account.
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                  Waiting on customer
                </span>
                <span className="text-muted-foreground">
                  Invite email sent — they haven&apos;t finished setting up their account yet.
                </span>
              </div>
              <form action={resendCustomerInviteEmail.bind(null, onboarding.id)}>
                <Button type="submit" variant="outline" size="sm">
                  Resend invite email
                </Button>
              </form>
            </div>
          )}
        </div>
      ) : onboarding.current_stage === "site_setup" ? (
        <div className="rounded-lg border border-border bg-card p-5 space-y-5">
          <h2 className="text-sm font-semibold">Site &amp; Device Setup</h2>

          {!site ? (
            <form action={createSite.bind(null, onboarding.id)} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Site name</label>
                <Input name="siteName" placeholder="e.g. Rajan Residence, Anna Nagar" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Property type</label>
                <select
                  name="propertyType"
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select property type…
                  </option>
                  {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Power source</label>
                <select
                  name="powerSourceCategory"
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select power source…
                  </option>
                  {Object.entries(POWER_SOURCE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" size="sm">
                Create Site
              </Button>
            </form>
          ) : (
            <>
              <div className="rounded-md border border-border p-3 text-sm">
                <p className="font-medium">{site.name}</p>
                <p className="text-muted-foreground">
                  {PROPERTY_TYPE_LABELS[site.property_type] ?? site.property_type} ·{" "}
                  {POWER_SOURCE_LABELS[site.power_source_category] ?? site.power_source_category}
                </p>
              </div>

              <div className="space-y-3 border-t border-border pt-4">
                <h3 className="text-sm font-semibold">Devices ({devices.length})</h3>
                {devices.length > 0 && (
                  <ul className="space-y-2">
                    {devices.map((d) => (
                      <li key={d.id} className="rounded-md border border-border p-3 text-sm">
                        <span className="font-medium">{d.device_type?.name ?? "Device"}</span>{" "}
                        <span className="text-muted-foreground">
                          — {d.label || d.device_uid} ({d.device_uid})
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <form
                  action={addDevice.bind(null, onboarding.id, site.id)}
                  className="flex flex-wrap items-end gap-2"
                >
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Device type</label>
                    <select
                      name="deviceTypeId"
                      className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                      required
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Select…
                      </option>
                      {deviceTypes.map((dt) => (
                        <option key={dt.id} value={dt.id}>
                          {dt.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Device ID</label>
                    <Input name="deviceUid" placeholder="e.g. deye-8k-01" className="h-9 w-40" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Label (optional)</label>
                    <Input name="label" placeholder="e.g. Rooftop Inverter" className="h-9 w-40" />
                  </div>
                  <Button type="submit" size="sm">
                    Add Device
                  </Button>
                </form>

                {deviceTypes.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Instrument checklist by device type:
                    </p>
                    {deviceTypes.map((dt) => (
                      <div key={dt.id} className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{dt.name}:</span>{" "}
                        {dt.device_type_instruments
                          .map((i) => `${i.instrument_name}${i.unit ? ` (${i.unit})` : ""}${i.is_required ? "*" : ""}`)
                          .join(", ")}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {devices.length > 0 && (
                <form action={completeSiteSetup.bind(null, onboarding.id)} className="border-t border-border pt-4">
                  <Button type="submit" size="sm">
                    Site Setup Complete → Connection Test
                  </Button>
                </form>
              )}
            </>
          )}
        </div>
      ) : onboarding.current_stage === "connection_test" ? (
        <div className="rounded-lg border border-border bg-card p-5 space-y-5">
          <h2 className="text-sm font-semibold">Connection Test</h2>

          {!site || devices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No site or devices found for this customer — go back to Site &amp; Device Setup first.
            </p>
          ) : !testSession || testSession.status !== "running" ? (
            <div className="space-y-3">
              {testSession && (
                <p className="text-sm text-muted-foreground">
                  Last session:{" "}
                  <span className="capitalize font-medium text-foreground">{testSession.status}</span>
                  {testSession.notes ? ` — ${testSession.notes}` : ""}
                </p>
              )}
              <form action={startTestSession.bind(null, onboarding.id, site.id)}>
                <Button type="submit" size="sm">
                  Start Connection Test
                </Button>
              </form>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Simulated — no real device gateway is wired up yet. &quot;Send Test Signal&quot; writes
                plausible sample readings so the wiring (RLS → live panel → verification) can be proven
                end to end.
              </p>

              <MonitoringPanel
                devices={devices.map((d) => ({
                  id: d.id,
                  label: d.label,
                  deviceUid: d.device_uid,
                  typeName: d.device_type?.name ?? null,
                }))}
                isTestOnly
                pollIntervalMs={4000}
                emptyMessage="No test signal received yet."
              />

              <div className="space-y-3 border-t border-border pt-4">
                {devices.map((device) => {
                  const requiredInstruments = (device.device_type?.device_type_instruments ?? []).filter(
                    (i) => i.is_required
                  );
                  const payload = JSON.stringify(
                    requiredInstruments.map((i) => ({ key: i.instrument_key, unit: i.unit }))
                  );
                  return (
                    <div
                      key={device.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
                    >
                      <div className="text-sm">
                        <span className="font-medium">{device.device_type?.name ?? "Device"}</span>{" "}
                        <span className="text-muted-foreground">— {device.label || device.device_uid}</span>{" "}
                        <span
                          className={`ml-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            device.status === "active"
                              ? "bg-primary/15 text-primary"
                              : "bg-accent text-accent-foreground"
                          }`}
                        >
                          {device.status}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <form action={sendTestSignal.bind(null, onboarding.id, device.id)}>
                          <input type="hidden" name="instrumentKeys" value={payload} />
                          <Button type="submit" variant="outline" size="sm" disabled={requiredInstruments.length === 0}>
                            Send Test Signal
                          </Button>
                        </form>
                        {device.status !== "active" && (
                          <form action={markDeviceVerified.bind(null, onboarding.id, device.id)}>
                            <Button type="submit" size="sm">
                              Mark Verified
                            </Button>
                          </form>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                <form action={completeConnectionTest.bind(null, onboarding.id, testSession.id, site.id)}>
                  <Button type="submit" size="sm" disabled={devices.some((d) => d.status !== "active")}>
                    Connection Verified → Schedule Install
                  </Button>
                </form>
                <form action={failTestSession.bind(null, onboarding.id, testSession.id)} className="flex gap-2">
                  <Input name="notes" placeholder="Reason (optional)" className="h-9 w-56" />
                  <Button type="submit" variant="destructive" size="sm">
                    Mark Failed
                  </Button>
                </form>
              </div>
            </>
          )}
        </div>
      ) : onboarding.current_stage === "install_scheduled" ? (
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold">Schedule Install</h2>

          {!site || devices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No site or devices found for this customer.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-muted-foreground">
                  Devices ({devices.length}) — connection verified
                </h3>
                <ul className="space-y-1.5">
                  {devices.map((d) => (
                    <li key={d.id} className="text-sm">
                      <span className="font-medium">{d.device_type?.name ?? "Device"}</span>{" "}
                      <span className="text-muted-foreground">— {d.label || d.device_uid}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-t border-border pt-4">
                {onboarding.install_scheduled_at ? (
                  <p className="text-sm">
                    Scheduled for{" "}
                    <span className="font-medium">
                      {new Date(onboarding.install_scheduled_at).toLocaleDateString("en-IN", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">No install date set yet.</p>
                )}

                <form action={scheduleInstall.bind(null, onboarding.id)} className="mt-3 flex items-end gap-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Install date</label>
                    <Input
                      type="date"
                      name="scheduledDate"
                      defaultValue={onboarding.install_scheduled_at?.slice(0, 10) ?? ""}
                      className="h-9 w-44"
                      required
                    />
                  </div>
                  <Button type="submit" variant="outline" size="sm">
                    {onboarding.install_scheduled_at ? "Reschedule" : "Schedule"}
                  </Button>
                </form>
              </div>

              {onboarding.install_scheduled_at && (
                <form action={completeInstallation.bind(null, onboarding.id, site.id)} className="border-t border-border pt-4">
                  <Button type="submit" size="sm">
                    Installation Complete
                  </Button>
                </form>
              )}
            </>
          )}
        </div>
      ) : onboarding.current_stage === "install_completed" ? (
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
              Complete
            </span>
            <h2 className="text-sm font-semibold">Onboarding Complete</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {lead?.full_name ?? "This customer"} is fully onboarded — their system is live and the
            dashboard is available to them.
          </p>

          {site && devices.length > 0 && (
            <div className="space-y-1.5 border-t border-border pt-4">
              <h3 className="text-xs font-medium text-muted-foreground">Installed devices</h3>
              <ul className="space-y-1.5 text-sm">
                {devices.map((d) => (
                  <li key={d.id} className="flex items-center justify-between">
                    <span>
                      <span className="font-medium">{d.device_type?.name ?? "Device"}</span>{" "}
                      <span className="text-muted-foreground">— {d.label || d.device_uid}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {d.installed_at ? new Date(d.installed_at).toLocaleDateString("en-IN") : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : onboarding.current_stage !== "quotation_sent" ? (
        <div className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
          Unrecognized stage:{" "}
          <span className="font-medium capitalize">
            {onboarding.current_stage.replace(/_/g, " ")}
          </span>
          . Every real onboarding_stage value has its own view above this — if you&apos;re seeing this,
          something set current_stage to a value outside that enum.
        </div>
      ) : activeQuotation ? (
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">
                Quotation — {activeQuotation.plan?.name ?? "Plan"}
              </h2>
              <p className="text-sm text-muted-foreground">
                ₹{Number(activeQuotation.total_amount).toLocaleString("en-IN")} · sent{" "}
                {activeQuotation.sent_at
                  ? new Date(activeQuotation.sent_at).toLocaleDateString("en-IN")
                  : "—"}
              </p>
              {activeQuotation.subtotal_amount != null && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Subtotal ₹{Number(activeQuotation.subtotal_amount).toLocaleString("en-IN")} + GST (
                  {activeQuotation.gst_rate}%) ₹{Number(activeQuotation.gst_amount ?? 0).toLocaleString("en-IN")}
                </p>
              )}
            </div>
            {activeQuotation.pdf_url && (
              <a
                href={activeQuotation.pdf_url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-primary hover:underline"
              >
                View PDF
              </a>
            )}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <form
              action={recordQuotationAccepted.bind(null, activeQuotation.id, onboarding.id)}
            >
              <Button type="submit" size="sm">
                Customer Accepted
              </Button>
            </form>
            <form
              action={recordQuotationRejected.bind(null, activeQuotation.id, onboarding.id)}
            >
              <input type="hidden" name="action" value="re-quote" />
              <Button type="submit" variant="outline" size="sm">
                Rejected — Re-quote
              </Button>
            </form>
            <form
              action={recordQuotationRejected.bind(null, activeQuotation.id, onboarding.id)}
            >
              <input type="hidden" name="action" value="close" />
              <Button type="submit" variant="destructive" size="sm">
                Rejected — Close Lead
              </Button>
            </form>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold">
            {pastQuotations.length > 0 ? "Send a new quotation" : "Create a quotation"}
          </h2>
          {plans && plans.length > 0 ? (
            <QuotationForm onboardingId={onboarding.id} plans={plans} />
          ) : (
            <p className="text-sm text-muted-foreground">
              No active plans found — add one in the plan catalog first.
            </p>
          )}
        </div>
      )}

      {pastQuotations.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Previous quotations</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
            {pastQuotations.map((q) => (
              <li key={q.id} className="flex items-center justify-between">
                <span>
                  {q.plan?.name ?? "Plan"} — ₹{Number(q.total_amount).toLocaleString("en-IN")}
                </span>
                <span className="capitalize">{q.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {lead && (
        <div className="rounded-lg border border-border bg-card p-5 text-sm">
          <h2 className="mb-2 font-semibold">Customer</h2>
          <p className="text-muted-foreground">{lead.email}</p>
          <p className="text-muted-foreground">{lead.phone}</p>
        </div>
      )}
    </div>
  );
}
