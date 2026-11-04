"use client";

import * as React from "react";
import { CalendarCheck, ChevronDown, EvCharger, HeartPulse, Server, TriangleAlert, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { agoText } from "@/lib/device-status-summary";
import { getFaultInfo, type FaultEvent } from "@/lib/deye-fault-codes";
import { inverterGuide } from "@/lib/troubleshooting-guide";
import type { DeviceSyncInit } from "@/lib/device-sync-types";
import { HEALTH_KEYS, VERDICT_LABEL, buildHealthChecks, checkReportText, checkSubject, faultReportText, faultSubject, problemCount, verdictOf, type Verdict } from "@/lib/maintenance-health";
import type { EvMaintData } from "@/lib/ev-maint-data";
import { FAULT_BITMASK_KEYS_LIVE } from "@/lib/overview-keys";
import { faultCodeOf } from "@/lib/notification-items";
import { useLiveNumbers } from "@/lib/telemetry/live-values";
import { cn } from "@/lib/utils";
import { FaultHistoryCard } from "./fault-history-card";
import { Alert } from "@/components/ui/alert";
import { TroubleshootingGuide } from "./troubleshooting-guide";
import { TemperatureGauge } from "./temperature-gauge";
import { useDeviceState } from "./use-device-state";
import { useHashTab } from "./use-hash-tab";
import { EvMaintHealth, useEvMaintHealth } from "./ev-maint-health";
import { CHECK_ICON, ReportButton, type ReportTarget } from "./maintenance-report";

export type { ReportTarget } from "./maintenance-report";

/** The tabs of the page: a site's inverter and charger (each with its own health), then Service for all of its devices. A device that is neither
 *  has one "Health" tab of its own. */
type TabId = "solar" | "ev" | "device" | "service";
const TABS: Record<TabId, { label: string; icon: LucideIcon; active: string; circle: string }> = {
  solar: { label: "Inverter", icon: Server, active: "data-[state=active]:border-primary data-[state=active]:text-primary", circle: "bg-primary/15 text-primary" },
  ev: { label: "EV Charger", icon: EvCharger, active: "data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400", circle: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  device: { label: "Health", icon: HeartPulse, active: "data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400", circle: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  service: { label: "Service", icon: CalendarCheck, active: "data-[state=active]:border-sky-500 data-[state=active]:text-sky-600 dark:data-[state=active]:text-sky-400", circle: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
};

export interface HeadlineData {
  label: string;
  value: string;
  figures: { label: string; value: string }[];
}

export interface SolarHealthProps {
  initial: Record<string, number | null>;
  faultEvents: FaultEvent[];
  faultHistoryFailed: boolean;
  gauges: { key: string; label: string; warnAboveC: number }[];
  previousTemps: Record<string, number | null>;
  faultDays: number;
  /** Today in India (YYYY-MM-DD) and the first day with readings: the fault history's date picker needs them. */
  today: string;
  firstDay: string | null;
}

/** One device's health, as the page's server side gathers it. */
export interface MaintenanceDevice {
  kind: "solar" | "ev" | "device";
  deviceId: string;
  sync: DeviceSyncInit;
  /** The live health of a solar inverter; null for other devices, which bring their own `health` content. */
  solar: SolarHealthProps | null;
  health: React.ReactNode;
  /** What the health needs about an EV charger (its unit, connector, last charge, events); null for any other device. */
  ev: EvMaintData | null;
  technical: React.ReactNode;
  /** Which device a Support request is about (a fault or a check that is not fine); null hides those buttons. */
  report: ReportTarget | null;
  /** The subjects of the customer's open Support tickets for this device, so the same fault is not reported twice. */
  openIssues: string[];
}

/** The Maintenance page, one board for the whole site: the details header of the open tab, the tabs under it (Inverter, EV Charger, then Service
 *  with every device's plan, warranty and visits), and the tab's content. A device's health follows its live channel (connection, faults,
 *  temperatures, checks); Service is rendered by the server. A problem is reported in Support: the fault and check buttons open its new-ticket
 *  form with the details filled in. */
export function MaintenanceBoard({ devices, defaultKind, service }: { devices: MaintenanceDevice[]; defaultKind: MaintenanceDevice["kind"]; service: { headline: HeadlineData; content: React.ReactNode } }) {
  const tabs: TabId[] = [...devices.map((d) => d.kind), "service"];
  const [section, open] = useHashTab(tabs, devices.some((d) => d.kind === defaultKind) ? defaultKind : devices[0]!.kind);
  const device = devices.find((d) => d.kind === section);
  if (device) return <DeviceHealthPage key={device.deviceId} device={device} tabs={tabs} section={section} onOpen={open} />;
  return (
    <Page tabs={tabs} section={section} onOpen={open} head={service.headline} tone={null}>
      {service.content}
    </Page>
  );
}

/** The header, the tab strip under it and the open tab's content. */
function Page({ tabs, section, onOpen, head, tone, children }: { tabs: TabId[]; section: TabId; onOpen: (id: TabId) => void; head: HeadlineData; tone: Verdict | null; children: React.ReactNode }) {
  const meta = TABS[section];
  const Icon = section === "service" ? CalendarCheck : HeartPulse;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-4">
          <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-full", tone === "attention" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : tone === "offline" ? "bg-destructive/15 text-destructive" : meta.circle)}>
            <Icon className="size-7" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-theme-muted">{head.label}</p>
            <p className={cn("text-4xl font-semibold leading-tight tracking-tight", tone === "good" ? "text-emerald-600 dark:text-emerald-400" : tone === "attention" ? "text-amber-600 dark:text-amber-400" : tone === "offline" ? "text-destructive" : "text-theme-primary")}>{head.value}</p>
          </div>
          <div className="hidden items-center gap-8 pl-6 md:flex">
            {head.figures.map((f) => (
              <div key={f.label}>
                <p className="text-sm font-medium text-theme-muted">{f.label}</p>
                <p className="text-2xl font-semibold tracking-tight text-theme-primary">{f.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Tabs value={section} onValueChange={(v) => onOpen(v as TabId)}>
        <TabsList variant="line">
          {tabs.map((id) => {
            const t = TABS[id];
            return (
              <TabsTrigger key={id} value={id} variant="line" className={t.active}>
                <t.icon className="size-4 shrink-0 group-data-[state=active]:hidden" />
                <span className="text-sm font-medium">{t.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value={section} className="mt-4 outline-none">
          {children}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** One device's Health tab: its live state, its header and its checks. Mounted only while that tab is open. */
function DeviceHealthPage({ device, tabs, section, onOpen }: { device: MaintenanceDevice; tabs: TabId[]; section: TabId; onOpen: (id: TabId) => void }) {
  const { deviceId, sync, solar, health, ev, technical, report, openIssues } = device;
  const state = useDeviceState(deviceId, sync);
  const live = useLiveNumbers([deviceId], [...HEALTH_KEYS, ...FAULT_BITMASK_KEYS_LIVE], solar?.initial ?? {}, () => "first");
  const [clock, setClock] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const value = (key: string) => live[key] ?? solar?.initial[key] ?? null;
  const faultCode = faultCodeOf(Object.fromEntries(FAULT_BITMASK_KEYS_LIVE.map((k) => [k, value(k)])));
  const checks = React.useMemo(
    () => buildHealthChecks({ connection: state.status, faultCode, value }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.status, faultCode, live, solar]
  );
  const verdict = verdictOf(state.status, checks);
  const problems = problemCount(checks);
  const lastRead = state.lastReadAt ? agoText(clock - new Date(state.lastReadAt).getTime()) : "—";
  const evHealth = useEvMaintHealth(deviceId, sync, state, ev);

  const head: HeadlineData = solar
    ? { label: "System health", value: VERDICT_LABEL[verdict], figures: [{ label: "Last data", value: lastRead }, { label: "Open issues", value: String(problems) }] }
    : evHealth
      ? { label: "Charger health", value: VERDICT_LABEL[evHealth.verdict], figures: [{ label: "Last check-in", value: evHealth.lastCheckIn }, { label: "Open issues", value: String(evHealth.problems) }] }
      : { label: "Device health", value: state.status === "online" ? "Reporting" : "Not reporting", figures: [{ label: "Last data", value: lastRead }] };
  const tone: Verdict | null = solar ? verdict : evHealth ? evHealth.verdict : null;

  return (
    <Page tabs={tabs} section={section} onOpen={onOpen} head={head} tone={tone}>
      {solar ? (
        <SolarHealth solar={solar} checks={checks} faultCode={faultCode} value={value} technical={technical} report={report} openIssues={openIssues} />
      ) : evHealth && ev ? (
        <div className="space-y-4">
          <EvMaintHealth health={evHealth} events={ev.events} report={report} openIssues={openIssues} />
          {health}
        </div>
      ) : (
        health
      )}
    </Page>
  );
}

function SolarHealth({ solar, checks, faultCode, value, technical, report, openIssues }: { solar: SolarHealthProps; checks: ReturnType<typeof buildHealthChecks>; faultCode: number | null; value: (key: string) => number | null; technical: React.ReactNode; report: ReportTarget | null; openIssues: string[] }) {
  const guide = React.useMemo(() => inverterGuide(), []);
  const activeCodes = faultCode ? [getFaultInfo(faultCode)?.code ?? ""] : [];
  return (
    <div className="space-y-4">
      <ActiveFault faultCode={faultCode} report={report} openIssues={openIssues} />

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm">Checks</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border/60">
              {checks.map((c) => {
                const { Icon, className } = CHECK_ICON[c.state];
                return (
                  <li key={c.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                    <Icon className={cn("mt-0.5 size-4 shrink-0", className)} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{c.label}</p>
                      <p className="text-xs text-muted-foreground">{c.detail}</p>
                    </div>
                    {c.state !== "ok" && c.id !== "fault" && report && (
                      <ReportButton report={report} tag={checkSubject(c.label)} subject={checkSubject(c.label)} text={checkReportText(c.label, c.detail)} openIssues={openIssues} label="Get support" />
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        {solar.gauges.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm">Temperatures</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {solar.gauges.map((g) => (
                <TemperatureGauge key={g.key} label={g.label} valueC={value(g.key)} warnAboveC={g.warnAboveC} previousValueC={solar.previousTemps[g.key] ?? null} />
              ))}
              <p className="text-xs text-muted-foreground">The arrow compares with this time yesterday. The bar fills toward each sensor&apos;s safe limit.</p>
            </CardContent>
          </Card>
        )}
      </div>

      <FaultHistoryCard deviceId={report?.deviceId ?? ""} today={solar.today} firstDay={solar.firstDay} initial={{ events: solar.faultEvents, failed: solar.faultHistoryFailed }} />

      <TroubleshootingGuide sections={guide} active={activeCodes} />

      {technical && <TechnicalDetails>{technical}</TechnicalDetails>}
    </div>
  );
}

/** The raw registers (alarm words, battery flags, wiring bits), closed by default: useful on a call with support, noise otherwise. */
function TechnicalDetails({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button type="button" className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted/50">
          <span>
            Technical details
            <span className="ml-2 text-xs font-normal text-muted-foreground">Raw readings, for support</span>
          </span>
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 pt-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}

/** The fault the inverter is reporting now: what it is, what to try, and a button to report it (once, until that request is closed). */
function ActiveFault({ faultCode, report, openIssues }: { faultCode: number | null; report: ReportTarget | null; openIssues: string[] }) {
  const fault = faultCode ? getFaultInfo(faultCode) : null;
  if (!fault) return null;
  const critical = fault.severity === "critical";
  return (
    <Alert variant={critical ? "destructive" : "default"} className="flex flex-wrap items-start justify-between gap-3 sm:flex-nowrap">
      <div className="flex min-w-0 items-start gap-3">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold leading-snug">
            {fault.code} · {fault.label}
          </p>
          <p className="text-sm text-muted-foreground">{fault.description}</p>
          <ol className="list-decimal space-y-0.5 pl-5 text-sm text-foreground marker:text-muted-foreground">
            {fault.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      </div>
      {report && <ReportButton report={report} tag={`Fault ${fault.code} `} subject={faultSubject(fault.code, fault.label)} text={faultReportText(fault.code, fault.label, fault.description)} openIssues={openIssues} label="Get support for this fault" />}
    </Alert>
  );
}
