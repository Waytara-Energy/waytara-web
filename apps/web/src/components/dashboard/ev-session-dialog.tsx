"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, ReferenceArea, XAxis, YAxis } from "recharts";
import { Clock, Gauge, IndianRupee, Leaf, Loader2, Thermometer, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { useUnits } from "@/components/units-provider";
import { formatSeconds, type CurvePoint } from "@/lib/ev-sessions";
import { GAP_S, type EvGap, type EvSessionDetail } from "@/lib/ev-session-detail";
import { cn } from "@/lib/utils";
import { FLOW } from "./flow-colors";

export type EvSessionLoader = (id: string) => Promise<{ ok: true; detail: EvSessionDetail } | { ok: false; message: string }>;

const inr = (v: number) => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: v < 10 ? 2 : 0 })}`;
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit", timeZone: "Asia/Kolkata" });
const hm = (t: number) => new Date(t).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

const SOURCE_COLOR = { solar: FLOW.producing, battery: FLOW.drawing, grid: FLOW.idle, unattributed: "var(--border)" } as const;
const chartConfig = {
  solar: { label: "Solar (kW)", color: FLOW.producing },
  battery: { label: "Battery (kW)", color: FLOW.drawing },
  grid: { label: "Grid (kW)", color: FLOW.idle },
  kw: { label: "Power (kW)", color: FLOW.consuming },
} satisfies ChartConfig;
const axis = { tickLine: false, axisLine: false, tick: { fontSize: 10, fill: "var(--muted-foreground)" } } as const;

function Tile({ icon: Icon, label, value, hint }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; hint?: string | null }) {
  return (
    <div className="min-w-0 rounded-xl bg-muted/50 p-3">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      <p className="mt-1.5 truncate text-lg font-semibold tabular-nums text-foreground">{value}</p>
      {hint ? <p className="truncate text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      {children}
    </section>
  );
}

/** The power over the charge, split by where it came from when the site's readings were there for most of it; the silences in the readings are
 *  shaded and the line is broken across them (it is not drawn as if the power were known). */
function PowerChart({ points: raw, gaps }: { points: CurvePoint[]; gaps: EvGap[] }) {
  const points = React.useMemo(() => {
    const out: (CurvePoint | { t: number; kw: null; solar: null; battery: null; grid: null })[] = [];
    raw.forEach((p, i) => {
      const prev = raw[i - 1];
      if (prev && (p.t - prev.t) / 1000 > GAP_S) out.push({ t: prev.t + 1000, kw: null, solar: null, battery: null, grid: null });
      out.push(p);
    });
    return out;
  }, [raw]);
  if (raw.length < 2) return <p className="text-sm text-muted-foreground">The curve appears once the charger has reported a few readings.</p>;
  const split = raw.filter((p) => p.solar !== null).length >= raw.length * 0.7;
  const domain: [number, number] = [raw[0].t, raw[raw.length - 1].t];
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-48 w-full">
      <AreaChart data={points} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis type="number" dataKey="t" domain={domain} tickFormatter={hm} scale="time" tickCount={5} {...axis} />
        <YAxis width={28} {...axis} />
        {gaps.map((g) => (
          <ReferenceArea key={g.from} x1={Date.parse(g.from)} x2={Date.parse(g.to)} fill="var(--muted-foreground)" fillOpacity={0.12} ifOverflow="visible" />
        ))}
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, p) => (p?.[0]?.payload ? hm((p[0].payload as CurvePoint).t) : "")} />} />
        {split ? (
          <>
            <Area dataKey="grid" stackId="s" type="monotone" stroke="var(--color-grid)" fill="var(--color-grid)" fillOpacity={0.45} dot={false} isAnimationActive={false} />
            <Area dataKey="battery" stackId="s" type="monotone" stroke="var(--color-battery)" fill="var(--color-battery)" fillOpacity={0.45} dot={false} isAnimationActive={false} />
            <Area dataKey="solar" stackId="s" type="monotone" stroke="var(--color-solar)" fill="var(--color-solar)" fillOpacity={0.45} dot={false} isAnimationActive={false} />
          </>
        ) : (
          <Area dataKey="kw" type="monotone" stroke="var(--color-kw)" fill="var(--color-kw)" fillOpacity={0.2} strokeWidth={1.75} dot={false} isAnimationActive={false} />
        )}
      </AreaChart>
    </ChartContainer>
  );
}

function Detail({ d }: { d: EvSessionDetail }) {
  const u = useUnits();
  const kwh = (v: number, digits = 2) => u.format(v, "kWh", "ev_energy_today_kwh", digits);
  const kw = (v: number) => u.format(v, "kW", "power_active_import_kw", 1);
  const booked = d.bookedKwh;
  const done = d.kwh;
  const pct = booked !== null && booked > 0 && done !== null ? (done / booked) * 100 : null;

  return (
    <div className="space-y-6">
      <Section title="Booked and completed">
        {booked !== null ? (
          <div className="space-y-2">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, pct ?? 0)}%` }} />
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
              <span className="text-muted-foreground">
                Booked <span className="font-semibold tabular-nums text-foreground">{kwh(booked)}</span>
              </span>
              <span className="text-muted-foreground">
                Completed <span className="font-semibold tabular-nums text-foreground">{done !== null ? kwh(done) : "—"}</span>
                {pct !== null ? <span className="tabular-nums"> ({Math.round(pct)}%)</span> : null}
              </span>
            </div>
            {pct !== null && pct > 105 ? <p className="text-xs text-muted-foreground">It went {kwh((done ?? 0) - booked)} past the amount booked: the charger was out of contact and could not be told to stop in time.</p> : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No stop-after amount was set. <span className="font-semibold tabular-nums text-foreground">{done !== null ? kwh(done) : "—"}</span> delivered.
          </p>
        )}
      </Section>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Tile icon={Zap} label="Energy" value={done !== null ? kwh(done) : "—"} hint={d.peakKw !== null ? `peak ${kw(d.peakKw)}` : null} />
        <Tile icon={Clock} label="Charging time" value={d.chargingS !== null ? formatSeconds(d.chargingS) : "—"} hint={`${formatSeconds(d.spanS)} plugged in`} />
        <Tile icon={IndianRupee} label="Cost" value={d.cost !== null ? inr(d.cost) : "—"} hint={`at ${inr(d.tariffRate)} per kWh`} />
        <Tile icon={Leaf} label="Saved by solar" value={d.savedBySolar !== null ? inr(d.savedBySolar) : "—"} hint={d.savedBySolar !== null ? "grid cost avoided" : "no solar in this charge"} />
        <Tile icon={Gauge} label="Average power" value={d.avgKw !== null ? kw(d.avgKw) : "—"} hint={d.maxA !== null ? `up to ${d.maxA.toFixed(1)} A` : null} />
        <Tile icon={Zap} label="Peak power" value={d.peakKw !== null ? kw(d.peakKw) : "—"} hint={d.offeredA !== null ? `${d.offeredA} A offered` : null} />
        <Tile icon={Gauge} label="Voltage" value={d.voltage ? (d.voltage.min === d.voltage.max ? `${Math.round(d.voltage.min)} V` : `${Math.round(d.voltage.min)}–${Math.round(d.voltage.max)} V`) : "—"} />
        <Tile icon={Thermometer} label="Connector" value={d.temperature ? (d.temperature.min === d.temperature.max ? `${Math.round(d.temperature.min)} °C` : `${Math.round(d.temperature.min)}–${Math.round(d.temperature.max)} °C`) : "—"} />
      </div>

      <Section title="Where the energy came from">
        {d.shares ? (
          <div className="space-y-3">
            <div className="flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={d.shares.map((s) => `${s.label} ${Math.round(s.pct)}%`).join(", ")}>
              {d.shares.map((s) => (
                <div key={s.key} style={{ width: `${s.pct}%`, background: SOURCE_COLOR[s.key] }} />
              ))}
            </div>
            <ul className="grid gap-1.5 text-sm">
              {d.shares.map((s) => (
                <li key={s.key} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className="size-2.5 rounded-full" style={{ background: SOURCE_COLOR[s.key] }} />
                    {s.label}
                  </span>
                  <span className="tabular-nums text-foreground">
                    {kwh(s.kwh)} <span className="text-muted-foreground">· {Math.round(s.pct)}%</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">The site&apos;s readings were not available for this charge, so the sources are not known.</p>
        )}
        <PowerChart points={d.points} gaps={d.gaps} />
      </Section>

      <Section title="Log">
        {d.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events were recorded for this charge.</p>
        ) : (
          <ol className="relative space-y-3 border-l pl-4">
            {d.events.map((e, i) => (
              <li key={`${e.ts}-${i}`} className="relative text-sm">
                <span className={cn("absolute -left-[1.3rem] top-1.5 size-2 rounded-full", e.tone === "warn" ? "bg-amber-500" : e.tone === "good" ? "bg-emerald-500" : "bg-muted-foreground/50")} />
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-foreground">{e.label}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{clock(e.ts)}</span>
                </div>
                {e.note ? <p className="text-xs text-muted-foreground">{e.note}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </Section>

      {d.notes.length > 0 || d.coveragePct !== null ? (
        <Section title="About these figures">
          <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
            {d.coveragePct !== null ? <li>The site&apos;s own readings covered {Math.round(d.coveragePct)}% of the charge.</li> : null}
            {d.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}

/** The one-charge view: opens over the Overview when a charge in the list is pressed. `load` fetches it (the dashboard passes a server action). */
export function EvSessionDialog({ sessionId, onClose, load }: { sessionId: string | null; onClose: () => void; load: EvSessionLoader }) {
  return (
    <Dialog open={sessionId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88svh] max-w-2xl overflow-y-auto">
        {/* keyed by the charge, so each one starts from a fresh, loading state */}
        {sessionId ? <Loaded key={sessionId} id={sessionId} load={load} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function Loaded({ id, load }: { id: string; load: EvSessionLoader }) {
  const [state, setState] = React.useState<{ ok: true; detail: EvSessionDetail } | { ok: false; message: string } | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    load(id)
      .then((r) => !cancelled && setState(r))
      .catch(() => !cancelled && setState({ ok: false, message: "The details could not be loaded just now. Please try again." }));
    return () => {
      cancelled = true;
    };
  }, [id, load]);

  const d = state?.ok ? state.detail : null;
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2">
          {d ? when(d.startedAt) : "Charge"}
          {d ? (
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", d.status.tone === "warn" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : d.status.tone === "good" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>{d.status.label}</span>
          ) : null}
          {d?.isTest ? <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">Test</span> : null}
        </DialogTitle>
        <DialogDescription>{d ? [d.stopReason, d.endedAt ? `ended ${when(d.endedAt)}` : "in progress", d.transactionId !== null ? `charge no. ${d.transactionId}` : null].filter(Boolean).join(" · ") : "Loading the charge…"}</DialogDescription>
      </DialogHeader>
      {state === null ? (
        <div className="grid h-48 place-items-center text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : state.ok ? (
        <Detail d={state.detail} />
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">{state.message}</p>
      )}
    </>
  );
}
