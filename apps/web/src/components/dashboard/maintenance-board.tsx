"use client";

import * as React from "react";
import { CalendarCheck, CheckCircle2, ChevronDown, Flag, HeartPulse, MessageSquareText, TriangleAlert, XCircle, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { agoText } from "@/lib/device-status-summary";
import { getFaultInfo, type FaultEvent } from "@/lib/deye-fault-codes";
import { inverterGuide } from "@/lib/troubleshooting-guide";
import type { DeviceSyncInit } from "@/lib/device-sync-types";
import { HEALTH_KEYS, VERDICT_LABEL, alreadyReported, buildHealthChecks, checkReportTag, checkReportText, faultReportText, problemCount, verdictOf, type CheckState, type Verdict } from "@/lib/maintenance-health";
import { FAULT_BITMASK_KEYS_LIVE } from "@/lib/overview-keys";
import { faultCodeOf } from "@/lib/notification-items";
import { useLiveNumbers } from "@/lib/telemetry/live-values";
import { cn } from "@/lib/utils";
import { FaultHistoryCard } from "./fault-history-card";
import { NewMaintenanceTicketDialog } from "./new-maintenance-ticket-dialog";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { TroubleshootingGuide } from "./troubleshooting-guide";
import { TemperatureGauge } from "./temperature-gauge";
import { useDeviceState } from "./use-device-state";
import { useHashTab } from "./use-hash-tab";

type SectionId = "health" | "service" | "requests";
const SECTIONS: { id: SectionId; label: string; icon: LucideIcon; active: string; circle: string }[] = [
  { id: "health", label: "Health", icon: HeartPulse, active: "data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400", circle: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  { id: "service", label: "Service", icon: CalendarCheck, active: "data-[state=active]:border-sky-500 data-[state=active]:text-sky-600 dark:data-[state=active]:text-sky-400", circle: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  { id: "requests", label: "Requests", icon: MessageSquareText, active: "data-[state=active]:border-violet-500 data-[state=active]:text-violet-600 dark:data-[state=active]:text-violet-400", circle: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
];
const IDS = SECTIONS.map((s) => s.id);

export interface HeadlineData {
  label: string;
  value: string;
  figures: { label: string; value: string }[];
}

/** Where a report is filed: the device and site the page is about. */
export interface ReportTarget {
  deviceId: string;
  deviceLabel: string;
  siteId: string;
  siteName: string | null;
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

/** The Maintenance page: a headline for the open tab (like Performance's), the three tabs, and the report-an-issue button at the right.
 *  Health follows the device's live channel (connection, faults, temperatures, checks); Service and Requests are rendered by the server. */
export function MaintenanceBoard({
  deviceId,
  sync,
  solar,
  health,
  technical,
  service,
  requests,
  serviceHeadline,
  requestsHeadline,
  action,
  report,
  openIssues,
}: {
  deviceId: string;
  sync: DeviceSyncInit;
  /** The live health of a solar inverter; null for other devices, which bring their own `health` content. */
  solar: SolarHealthProps | null;
  health: React.ReactNode;
  technical: React.ReactNode;
  service: React.ReactNode;
  requests: React.ReactNode;
  serviceHeadline: HeadlineData;
  requestsHeadline: HeadlineData;
  action: React.ReactNode;
  /** Where a report is filed from the Health tab (a fault or a check that is not fine); null hides those buttons. */
  report: ReportTarget | null;
  /** The descriptions of the customer's open requests, so the same fault is not reported twice. */
  openIssues: string[];
}) {
  const [section, open] = useHashTab(IDS, "health");
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

  const healthHeadline: HeadlineData = solar
    ? { label: "System health", value: VERDICT_LABEL[verdict], figures: [{ label: "Last data", value: lastRead }, { label: "Open issues", value: String(problems) }] }
    : { label: "Device health", value: state.status === "online" ? "Reporting" : "Not reporting", figures: [{ label: "Last data", value: lastRead }] };
  const head = section === "service" ? serviceHeadline : section === "requests" ? requestsHeadline : healthHeadline;
  const meta = SECTIONS.find((s) => s.id === section)!;
  const Icon = meta.icon;
  const tone: Verdict | null = section === "health" && solar ? verdict : null;

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
        {action}
      </div>

      <Tabs value={section} onValueChange={(v) => open(v as SectionId)}>
        <TabsList variant="line">
          {SECTIONS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} variant="line" className={t.active}>
              <t.icon className="size-4 shrink-0 group-data-[state=active]:hidden" />
              <span className="text-sm font-medium">{t.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div key={section}>
        {section === "health" &&
          (solar ? (
            <SolarHealth solar={solar} checks={checks} faultCode={faultCode} value={value} technical={technical} report={report} openIssues={openIssues} />
          ) : (
            health
          ))}
        {section === "service" && service}
        {section === "requests" && requests}
      </div>
    </div>
  );
}

const CHECK_ICON: Record<CheckState, { Icon: LucideIcon; className: string }> = {
  ok: { Icon: CheckCircle2, className: "text-emerald-500" },
  warn: { Icon: TriangleAlert, className: "text-amber-500" },
  bad: { Icon: XCircle, className: "text-destructive" },
};

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
                      <ReportButton report={report} tag={checkReportTag(c.label)} text={checkReportText(c.label, c.detail)} openIssues={openIssues} label="Report" />
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

/** A button that files a request about something the page has shown (prefilled), or says it is already reported while that request is open. */
function ReportButton({ report, tag, text, openIssues, label, size = "sm" }: { report: ReportTarget; tag: string; text: string; openIssues: string[]; label: string; size?: "sm" | "default" }) {
  if (alreadyReported(openIssues, tag)) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
        <CheckCircle2 className="size-3.5 text-emerald-500" />
        Reported
      </span>
    );
  }
  return (
    <NewMaintenanceTicketDialog
      deviceId={report.deviceId}
      deviceLabel={report.deviceLabel}
      siteId={report.siteId}
      siteName={report.siteName}
      defaultDescription={text}
      trigger={
        <Button variant="outline" size={size} className="h-7 shrink-0 gap-1.5 px-2.5 text-xs">
          <Flag className="size-3.5" />
          {label}
        </Button>
      }
    />
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
      {report && <ReportButton report={report} tag={`Fault ${fault.code} `} text={faultReportText(fault.code, fault.label, fault.description)} openIssues={openIssues} label="Report this fault" />}
    </Alert>
  );
}
