import Link from "next/link";
import { Maximize2 } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { cn } from "@/lib/utils";

/*
 * "Step by step" on the Platform page: four cards, each with an accent bar and a title, a short description, and a small picture of the dashboard
 * cut off by the card's edge. The pictures are drawn here (not screenshots), use sample numbers and are labelled as sample data. They only show
 * things the dashboard really does: devices with an online status, the live energy flow, a settings change that stays pending until the
 * inverter confirms it, and the e-mail when a device goes quiet.
 */

function Dot({ tone }: { tone: "ok" | "wait" | "warn" }) {
  return (
    <span
      className={cn("size-2 shrink-0 rounded-full", tone === "ok" && "bg-emerald-500", tone === "wait" && "bg-amber-500", tone === "warn" && "bg-red-500")}
      aria-hidden="true"
    />
  );
}

function Chip({ children, tone = "ok" }: { children: React.ReactNode; tone?: "ok" | "wait" | "warn" | "plain" }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
        tone === "ok" && "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
        tone === "wait" && "bg-amber-500/15 text-amber-700 dark:text-amber-300",
        tone === "warn" && "bg-red-500/12 text-red-600 dark:text-red-400",
        tone === "plain" && "bg-theme-border text-theme-secondary"
      )}
    >
      {children}
    </span>
  );
}

/** A window cut off at the right and bottom edges of its card, with a title bar and a "Sample data" tag. */
function MockWindow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div aria-hidden="true" className="absolute inset-y-0 left-8 right-0 select-none overflow-hidden rounded-tl-2xl border-l border-t border-theme-border bg-theme-bg shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.25)]">
      <div className="flex items-center gap-3 border-b border-theme-border px-4 py-2.5">
        <span className="flex gap-1.5">
          <span className="size-2 rounded-full bg-theme-border" />
          <span className="size-2 rounded-full bg-theme-border" />
          <span className="size-2 rounded-full bg-theme-border" />
        </span>
        <span className="text-[11px] font-medium text-theme-secondary">{title}</span>
        <span className="ml-auto mr-6 text-[10px] text-theme-muted">Sample data</span>
      </div>
      <div className="space-y-2.5 p-4 text-xs">{children}</div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-3 rounded-xl border border-theme-border bg-theme-surface px-3.5 py-2.5">{children}</div>;
}

function DevicesMock() {
  return (
    <MockWindow title="Devices">
      <Row>
        <Dot tone="ok" />
        <span className="font-semibold text-theme-primary">Hybrid inverter</span>
        <span className="text-theme-muted">via gateway</span>
        <span className="ml-auto"><Chip>Online</Chip></span>
      </Row>
      <Row>
        <Dot tone="ok" />
        <span className="font-semibold text-theme-primary">Energy meter</span>
        <span className="text-theme-muted">via gateway</span>
        <span className="ml-auto"><Chip>Online</Chip></span>
      </Row>
      <Row>
        <Dot tone="ok" />
        <span className="font-semibold text-theme-primary">EV charger</span>
        <span className="text-theme-muted">OCPP</span>
        <span className="ml-auto"><Chip>Connected</Chip></span>
      </Row>
    </MockWindow>
  );
}

function LiveMock() {
  const tiles = [
    { label: "Solar", value: "4.4 kW" },
    { label: "Home", value: "2.1 kW" },
    { label: "Battery", value: "82 %" },
    { label: "Grid", value: "0.3 kW" },
  ];
  return (
    <MockWindow title="Live energy">
      <div className="grid grid-cols-4 gap-2.5">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-theme-border bg-theme-surface px-3 py-2.5">
            <p className="text-[10px] text-theme-muted">{t.label}</p>
            <p className="mt-0.5 text-[13px] font-semibold text-theme-primary">{t.value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-theme-border bg-theme-surface px-3.5 py-3">
        <p className="text-[10px] text-theme-muted">Solar power today</p>
        <svg viewBox="0 0 300 48" className="mt-2 h-12 w-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="mock-live" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#10b981" stopOpacity="0.35" />
              <stop offset="1" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0 46 C40 44 60 30 100 16 S170 4 210 14 S270 36 300 44 L300 48 L0 48 Z" fill="url(#mock-live)" />
          <path d="M0 46 C40 44 60 30 100 16 S170 4 210 14 S270 36 300 44" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    </MockWindow>
  );
}

function ControlMock() {
  return (
    <MockWindow title="Inverter schedule">
      <Row>
        <span className="font-semibold text-theme-primary">Mon to Fri</span>
        <span className="text-theme-muted">06:00 to 09:00 · charge from grid</span>
        <span className="ml-auto"><Chip tone="wait">Pending</Chip></span>
      </Row>
      <Row>
        <span className="font-semibold text-theme-primary">Mon to Fri</span>
        <span className="text-theme-muted">11:00 to 16:00 · charge from solar</span>
        <span className="ml-auto"><Chip>Confirmed</Chip></span>
      </Row>
      <Row>
        <span className="font-semibold text-theme-primary">EV charger</span>
        <span className="text-theme-muted">Charging session</span>
        <span className="ml-auto"><Chip tone="plain">Stop</Chip></span>
      </Row>
    </MockWindow>
  );
}

function AlertsMock() {
  return (
    <MockWindow title="Alerts and reports">
      <Row>
        <Dot tone="warn" />
        <span className="font-semibold text-theme-primary">Inverter went quiet</span>
        <span className="text-theme-muted">10:42</span>
        <span className="ml-auto"><Chip tone="plain">E-mail sent</Chip></span>
      </Row>
      <Row>
        <Dot tone="ok" />
        <span className="font-semibold text-theme-primary">Inverter back online</span>
        <span className="text-theme-muted">10:55</span>
      </Row>
      <Row>
        <span className="font-semibold text-theme-primary">Monthly report</span>
        <span className="text-theme-muted">E-mailed on the 1st</span>
        <span className="ml-auto"><Chip tone="plain">Download</Chip></span>
      </Row>
    </MockWindow>
  );
}

const STEPS = [
  {
    title: "Connect your equipment",
    body: "The gateway reads your inverters, batteries and meters, and compatible chargers connect directly. Each one appears in your dashboard.",
    Mock: DevicesMock,
  },
  {
    title: "See it live",
    body: "Solar, battery, load, grid and EV charging on one live diagram, with daily, monthly and yearly history for every device.",
    Mock: LiveMock,
  },
  {
    title: "Change what is supported",
    body: "Change selected inverter settings and charger sessions from the dashboard. An inverter change shows as pending until the inverter confirms it.",
    Mock: ControlMock,
  },
  {
    title: "Stay informed",
    body: "Get an e-mail when a device goes quiet, and reports on the schedule you choose: daily, weekly or monthly, or download them any time.",
    Mock: AlertsMock,
  },
];

/** The four steps from connected equipment to a dashboard you use, each with a small picture of the dashboard. */
export function PlatformSteps() {
  return (
    <ol className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
      {STEPS.map(({ title, body, Mock }, i) => (
        <li key={title} className="h-full">
          <Reveal direction="up" duration={800} distance={24} delay={(i % 2) * 120} className="h-full">
            <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-theme-border bg-theme-surface">
              <div className="flex gap-4 px-8 pt-8">
                <span className="mt-0.5 h-12 w-1 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                <div>
                  <p className="text-xs font-semibold text-theme-muted">Step {i + 1}</p>
                  <h3 className="mt-0.5 text-xl font-semibold tracking-tight text-theme-primary">{title}</h3>
                </div>
              </div>
              <p className="max-w-md px-8 pt-4 text-[15px] leading-relaxed text-theme-muted">{body}</p>
              {/* The picture sits under the text, so the text can never run into it; its top corner is the only rounded one and the rest is cut by the card. */}
              <div className="min-h-8 flex-1" aria-hidden="true" />
              <div className="relative h-52 shrink-0">
                <Mock />
              </div>
              <Link
                href="#demo"
                aria-label="See the live demo"
                className="absolute bottom-4 right-4 z-10 flex size-12 items-center justify-center rounded-2xl border border-theme-border bg-theme-surface/90 text-theme-primary backdrop-blur transition-colors hover:border-emerald-500/50 hover:text-theme-highlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <Maximize2 className="size-5" aria-hidden="true" />
              </Link>
            </div>
          </Reveal>
        </li>
      ))}
    </ol>
  );
}
