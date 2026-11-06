import { CircleCheck, CircleX } from "lucide-react";

interface Tier {
  id: string;
  name: string;
  level: string;
  bestFor: string;
}

/** A cell is plain text, optionally with a muted second line (an add-on price), or a yes / no. */
type Cell = string | { text: string; note?: string } | boolean;

interface Row {
  label: string;
  values: [Cell, Cell, Cell];
}

const TIERS: Tier[] = [
  { id: "observe", name: "Observe", level: "Starter", bestFor: "Pilot projects and single small sites" },
  { id: "control", name: "Control", level: "Professional", bestFor: "Commercial buildings and multi-site managers" },
  { id: "orchestrate", name: "Orchestrate", level: "Enterprise", bestFor: "Industrial plants, microgrids and large portfolios" },
];

const ROWS: Row[] = [
  { label: "Sites", values: ["1 site", "Up to 5 sites", "Unlimited sites, with a portfolio roll-up view"] },
  {
    label: "Devices",
    values: [
      { text: "2 devices", note: "More can be added as an add-on" },
      { text: "10 devices", note: "More can be added as an add-on" },
      "Unlimited devices",
    ],
  },
  { label: "User seats", values: ["3 – 5 seats, single admin role", "Up to 15 seats, with custom role-based access (RBAC)", "Unlimited seats, with SSO"] },
  { label: "Telemetry", values: ["15-minute polling", "1-minute to 5-minute polling", "Real-time, sub-second telemetry"] },
  { label: "Data retention", values: ["12 months rolling", "3 to 5 years", "7+ years, with a cold-storage archive"] },
  {
    label: "Backups and data protection",
    values: [
      "Weekly backups kept 30 days, restore through a support ticket",
      "Daily backups kept 90 days, standard restore SLA",
      "Continuous backup with point-in-time recovery, an offsite copy and priority restore",
    ],
  },
  {
    label: "Core capabilities",
    values: ["Monitoring only", "Monitoring and historical data access", "Monitoring, historical data access and configuring devices from anywhere"],
  },
  {
    label: "Alerts and notifications",
    values: [
      "Basic e-mail and SMS threshold alerts",
      "Custom alert rules, anomaly alerts, e-mail, SMS and webhooks",
      "Multi-level escalation, on-call schedules, and alerts that trigger automated actions",
    ],
  },
  { label: "Analytics and reports", values: [false, "Download reports", "Download reports and create scheduled reports"] },
  { label: "Weather forecasting", values: [false, true, true] },
  {
    label: "Cost and savings",
    values: [
      "Basic energy cost view",
      "Time-of-use tariff costing, peak demand cost tracking and savings insights (you act on them yourself)",
      "Automated savings from peak shaving and demand response, tenant sub-billing and savings reports",
    ],
  },
  { label: "Gateway", values: ["WayTara Hub", "WayTara Hub Pro", "WayTara Hub Pro Max"] },
];

function Value({ cell }: { cell: Cell }) {
  if (cell === true) {
    return (
      <span className="inline-flex items-center">
        <CircleCheck className="size-6 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <span className="sr-only">Included</span>
      </span>
    );
  }
  if (cell === false) {
    return (
      <span className="inline-flex items-center">
        <CircleX className="size-6 text-theme-muted" aria-hidden="true" />
        <span className="sr-only">Not included</span>
      </span>
    );
  }
  if (typeof cell === "string") return <>{cell}</>;
  return (
    <>
      {cell.text}
      {cell.note && <span className="mt-1 block text-sm text-theme-muted">{cell.note}</span>}
    </>
  );
}

/**
 * The three plans side by side (Observe, Control, Orchestrate), frameless: a header for each plan, then one thin-ruled row per dimension. From a tablet up it is a
 * table; on a phone each plan becomes its own list, so nothing needs sideways scrolling.
 */
export function PlansTable() {
  return (
    <div>
      {/* tablet and wider: one table */}
      <div className="hidden md:block">
        <table className="w-full table-fixed border-collapse text-left">
          <caption className="sr-only">Compare the Observe, Control and Orchestrate plans</caption>
          <thead>
            <tr>
              <th scope="col" className="w-[22%] pb-8 align-bottom">
                <span className="sr-only">What is included</span>
              </th>
              {TIERS.map((t) => (
                <th key={t.id} scope="col" className="px-5 pb-8 align-bottom font-normal">
                  <span className="block text-sm font-semibold text-theme-muted">{t.level}</span>
                  <span className="mt-1 block text-[clamp(1.5rem,2.4vw,2.1rem)] font-bold leading-tight tracking-tight text-theme-primary">{t.name}</span>
                  <span className="mt-3 block text-[15px] leading-relaxed text-theme-secondary">{t.bestFor}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label} className="border-t border-theme-border">
                <th scope="row" className="py-5 pr-4 align-top text-[15px] font-semibold text-theme-primary">
                  {row.label}
                </th>
                {row.values.map((cell, c) => (
                  <td key={TIERS[c].id} className="px-5 py-5 align-top text-[15px] leading-relaxed text-theme-secondary">
                    <Value cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* phone: one list for each plan */}
      <div className="space-y-14 md:hidden">
        {TIERS.map((t, c) => (
          <section key={t.id} aria-labelledby={`plan-${t.id}`}>
            <p className="text-sm font-semibold text-theme-muted">{t.level}</p>
            <h3 id={`plan-${t.id}`} className="mt-1 text-3xl font-bold tracking-tight text-theme-primary">
              {t.name}
            </h3>
            <p className="mt-2 text-[15px] leading-relaxed text-theme-secondary">{t.bestFor}</p>
            <dl className="mt-6">
              {ROWS.map((row) => (
                <div key={row.label} className="border-t border-theme-border py-4">
                  <dt className="text-sm font-semibold text-theme-primary">{row.label}</dt>
                  <dd className="mt-1 text-[15px] leading-relaxed text-theme-secondary">
                    <Value cell={row.values[c]} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <p className="mt-10 max-w-2xl text-sm leading-relaxed text-theme-muted">
        Plans and limits are our current packages and can change before you buy. We confirm exactly what is included in your quotation.
      </p>
    </div>
  );
}
