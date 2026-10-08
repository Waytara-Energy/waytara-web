"use client";

import * as React from "react";
import { BellRing, ExternalLink, Info } from "lucide-react";
import type { ResolvedTariff } from "@/lib/tariff";
import { CATEGORY_LABEL } from "@/lib/tariff";
import { fmtDate, inr, paybackMonths, type Bill, type MonthRow } from "@/lib/savings";
import { freeUnitsFor } from "@/lib/tariff-schedule";
import { Panel, StatTile, StackedDailyBars } from "./perf-kit";

const COLORS = { avoided: "#10b981", export: "#3b82f6", without: "#f97316", with: "#10b981" };

/** The bands, free units and duty the bill is worked out with, so the customer can see exactly what is assumed. */
function TariffDetail({ tariff }: { tariff: ResolvedTariff }) {
  const s = tariff.schedule;
  const period = s.billingMonths === 2 ? "two months" : "month";
  const bands = s.slabs.map((b, i) => {
    const prevTop = i === 0 ? 0 : (s.slabs[i - 1].upTo ?? 0);
    const label = b.upTo === null ? `above ${prevTop}` : `${i === 0 ? 0 : prevTop + 1}-${b.upTo}`;
    return { label, rate: b.rate };
  });
  const free = freeUnitsFor(s, 0);
  return (
    <details className="mt-2 group">
      <summary className="cursor-pointer text-primary hover:underline">How your bill is worked out</summary>
      <div className="mt-2 space-y-2 rounded-lg bg-muted/40 p-3">
        {s.freeUnits > 0 && (
          <p>
            <span className="font-medium text-foreground">{free} units free every {period}</span>
            {s.freeUnitsCap !== null ? ` while you use up to ${s.freeUnitsCap} units; above that ${s.freeUnitsOverCap > 0 ? `only ${s.freeUnitsOverCap} are free` : "the whole bill is charged"}` : ""}. State scheme - it may need registration or a qualifying connection.
          </p>
        )}
        <p className="font-medium text-foreground">Energy charge per unit, for each {period} of use</p>
        <ul className="grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
          {bands.map((b) => (
            <li key={b.label} className="flex justify-between gap-3">
              <span>{b.label} units</span>
              <span className="tabular-nums text-foreground">₹{b.rate.toFixed(2)}</span>
            </li>
          ))}
        </ul>
        {(s.dutyPct > 0 || s.surchargePerKwh > 0) && (
          <p>
            {s.surchargePerKwh > 0 ? `Plus ₹${s.surchargePerKwh.toFixed(2)} per unit (fuel adjustment / wheeling)` : ""}
            {s.surchargePerKwh > 0 && s.dutyPct > 0 ? " and " : ""}
            {s.dutyPct > 0 ? `${s.surchargePerKwh > 0 ? "" : "Plus "}${s.dutyPct}% electricity duty` : ""}.
          </p>
        )}
        <p>{tariff.netMetering ? "Energy you send to the grid is set against what you buy, and any surplus carries to the next month until the financial year ends." : `Energy you send to the grid is paid at ₹${tariff.exportRate.toFixed(2)} per unit.`}</p>
      </div>
    </details>
  );
}

/** One line saying which rate the savings use and how sure it is, with the change notices above it. */
function RateNotice({ tariff }: { tariff: ResolvedTariff }) {
  const where = tariff.state ? `${tariff.state}, ${CATEGORY_LABEL[tariff.category]}` : CATEGORY_LABEL[tariff.category];
  return (
    <div className="space-y-2.5">
      {tariff.changedRecently && tariff.previous && (
        <div className="flex gap-3 rounded-xl border border-blue-500/40 bg-blue-500/10 p-3.5 text-blue-700 dark:text-blue-300">
          <BellRing className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              The electricity rate in {tariff.state} {tariff.rate > tariff.previous.rate ? "went up" : "came down"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              From ₹{tariff.previous.rate.toFixed(2)} to ₹{tariff.rate.toFixed(2)} per unit from {fmtDate(tariff.effectiveFrom ?? "")}. Your savings from that date use the new rate; earlier months keep the rate they had.
            </p>
          </div>
        </div>
      )}
      {tariff.upcoming && (
        <div className="flex gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-amber-700 dark:text-amber-300">
          <BellRing className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">A new electricity rate starts on {fmtDate(tariff.upcoming.effectiveFrom)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {tariff.state ?? "Your state"}: ₹{tariff.rate.toFixed(2)} becomes ₹{tariff.upcoming.rate.toFixed(2)} per unit. We will update your savings and e-mail you on the day.
            </p>
          </div>
        </div>
      )}
      <div className="flex gap-3 rounded-xl border border-border p-3.5">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 text-xs leading-relaxed text-muted-foreground">
          {tariff.source === "state" ? (
            <>
              <span className="font-medium text-foreground">{where} tariff</span>
              {tariff.effectiveFrom ? `, in force since ${fmtDate(tariff.effectiveFrom)}` : ""} - about ₹{tariff.rate.toFixed(2)} per unit on a typical bill.{" "}
              {tariff.confidence === "verified" ? "Taken from the regulator's order." : "Read from published tariff tables and not yet checked against the regulator's order, so treat the amounts as estimates."}
              {tariff.sourceUrl && (
                <>
                  {" "}
                  <a href={tariff.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-primary hover:underline">
                    Source <ExternalLink className="size-3" />
                  </a>
                </>
              )}
              <TariffDetail tariff={tariff} />
            </>
          ) : (
            <>
              <span className="font-medium text-foreground">₹{tariff.rate.toFixed(2)} per unit</span> - the rate set on your account. We do not have a {where} rate on file yet
              {tariff.state ? "" : " (your site's state is not in its address)"}; once we do, your savings switch to it and we tell you.
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function BillBars({ title, bill }: { title: string; bill: Bill }) {
  const top = Math.max(bill.withoutSolar, Math.abs(bill.withSolar), 1);
  const row = (label: string, value: number, color: string) => (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums text-foreground">{value < 0 ? `${inr(-value)} credit` : inr(value)}</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${Math.max(1.5, (Math.abs(value) / top) * 100)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      {row("Without solar", bill.withoutSolar, COLORS.without)}
      {row("With solar", bill.withSolar, COLORS.with)}
      <p className="text-sm">
        You saved <span className="font-semibold text-emerald-600 dark:text-emerald-400">{inr(bill.saved)}</span>
      </p>
    </div>
  );
}

/** The Cost & Savings section for a solar site: what the customer saved, as two bills, at the rate of their state and kind of
 *  property, with notices when that rate changes. */
export function CostSavings({
  tariff,
  lifetime,
  months,
  invested,
  savedPerDay,
  co2Kg,
  trees,
}: {
  tariff: ResolvedTariff;
  /** The bills since the inverter was commissioned: every month on file on its own bill, plus older energy at the typical rate. */
  lifetime: Bill | null;
  months: MonthRow[];
  invested: number;
  /** Saved per day over the last 30 days (null until there are a few days). */
  savedPerDay: number | null;
  co2Kg: number | null;
  trees: number | null;
}) {
  const life = lifetime;
  const thisMonth = months[months.length - 1] ?? null;
  const roi = life && invested > 0 ? (life.saved / invested) * 100 : null;
  const payback = life ? paybackMonths(invested, life.saved, savedPerDay) : null;
  const recovered = life && invested > 0 ? Math.min(100, (life.saved / invested) * 100) : null;
  const monthRows = months.map((m) => ({ label: m.label, avoided: m.bill.avoided, exported: m.bill.exportIncome }));

  return (
    <div className="space-y-4">
      <RateNotice tariff={tariff} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Saved this month" value={thisMonth ? inr(thisMonth.bill.saved) : "—"} hint={thisMonth ? `${thisMonth.days} day${thisMonth.days === 1 ? "" : "s"} so far` : "No readings yet"} tone="good" />
        <StatTile label="Saved since commissioning" value={life ? inr(life.saved) : "—"} hint="From the inverter's lifetime counters" />
        <StatTile label="Return on investment" value={roi === null ? "—" : `${roi.toFixed(0)}%`} hint={invested > 0 ? `of ${inr(invested)} paid` : "No payments recorded"} />
        <StatTile label="Time to break even" value={invested <= 0 ? "—" : payback === 0 ? "Recovered" : payback === null ? "—" : payback < 12 ? `${Math.ceil(payback)} months` : `${(payback / 12).toFixed(1)} years`} hint={payback === null && invested > 0 ? "Needs a few days of readings" : "At the last 30 days' pace"} />
      </div>

      <Panel title="Your bill with and without solar" description="What you would have paid if everything you used was bought from the grid, against what you actually pay after the energy you made and sold.">
        <div className="grid gap-6 lg:grid-cols-2">
          {thisMonth ? <BillBars title={`This month (${thisMonth.label})`} bill={thisMonth.bill} /> : <p className="text-sm text-muted-foreground">No readings this month yet.</p>}
          {life ? <BillBars title="Since commissioning" bill={life} /> : <p className="text-sm text-muted-foreground">The lifetime counters have not reported yet.</p>}
        </div>
      </Panel>

      {life && life.saved > 0 && (
        <Panel title="Where the saving came from" description={tariff.netMetering ? "Energy you did not have to buy, and the units you sent to the grid that cancelled units you bought." : `Energy you did not have to buy, and energy you sold at ₹${tariff.exportRate.toFixed(2)} per unit.`}>
          <div className="space-y-2">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
              <div style={{ width: `${(life.avoided / life.saved) * 100}%`, backgroundColor: COLORS.avoided }} />
              <div style={{ width: `${(life.exportIncome / life.saved) * 100}%`, backgroundColor: COLORS.export }} />
            </div>
            <div className="grid gap-1.5 text-xs sm:grid-cols-2">
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="size-2 rounded-[2px]" style={{ backgroundColor: COLORS.avoided }} />
                  Bought less from the grid
                </span>
                <span className="font-medium tabular-nums">{inr(life.avoided)}</span>
              </span>
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="size-2 rounded-[2px]" style={{ backgroundColor: COLORS.export }} />
                  Sold to the grid
                </span>
                <span className="font-medium tabular-nums">{inr(life.exportIncome)}</span>
              </span>
            </div>
          </div>
        </Panel>
      )}

      {monthRows.length > 0 && (
        <Panel title="Savings month by month" description="Each month is worked out at the rate that applied in that month.">
          <StackedDailyBars
            rows={monthRows}
            series={[
              { key: "avoided", label: "Bought less", color: COLORS.avoided },
              { key: "exported", label: "Sold", color: COLORS.export },
            ]}
            currency
          />
        </Panel>
      )}

      {invested > 0 && life && (
        <Panel title="Paying back your system" description="What your solar has saved against what you paid for it.">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Saved {inr(life.saved)}</span>
              <span>Paid {inr(invested)}</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${recovered ?? 0}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">
              {payback === 0 ? "Your system has paid for itself." : payback === null ? "We will estimate the break-even date once there are a few days of readings." : `At the last 30 days' pace, about ${payback < 12 ? `${Math.ceil(payback)} more months` : `${(payback / 12).toFixed(1)} more years`}.`}
            </p>
          </div>
        </Panel>
      )}

      {co2Kg !== null && (
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="CO₂ avoided" value={`${co2Kg.toFixed(0)} kg`} hint="Grid electricity your solar replaced" tone="good" />
          <StatTile label="Equal to trees planted" value={trees === null ? "—" : `${trees.toFixed(1)} a year`} hint="Carbon a tree absorbs in a year" />
        </div>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        Savings are an estimate: each month is billed on your state&apos;s slabs, free units and duty for your kind of property. Fixed charges, meter rent and later fuel surcharges are left out - they do not change with solar, so they do not change what you save. Your electricity bill is the final word.
      </p>
    </div>
  );
}
