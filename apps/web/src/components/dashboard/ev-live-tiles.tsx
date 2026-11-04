"use client";

import * as React from "react";
import { useLiveNumbers } from "@/lib/telemetry/live-values";
import { useUnits } from "@/components/units-provider";
import { evLiveFigures, minutesText } from "@/lib/ev-tab";
import type { SourceShare } from "@/lib/ev-sessions";
import { FLOW } from "./flow-colors";

const KEYS = ["power_active_import_kw", "current_import_l1_a", "voltage_l1_n_v", "energy_active_import_register_kwh"];

const SHARE_COLOR = { solar: FLOW.producing, battery: FLOW.drawing, grid: FLOW.idle, unattributed: "var(--border)" } as const;

/** What the running charge needs to be shown (from the session row). */
export interface LiveSession {
  startedAt: string;
  /** the charger's energy count when it began (kWh): this charge is the count now minus this */
  startKwh: number | null;
  targetKwh: number | null;
  shares: SourceShare[] | null;
  solarPct: number | null;
}

/**
 * The live charge as tiles, the way the other Monitoring tabs show their headline figures: power against the charger's rating, current and voltage, this
 * charge with its progress to the target, the time (and what is left), and where the energy comes from. They follow the charger's live channel; the
 * server's numbers show until the first live one. With no charge running every tile is a dash and the first one says what the last charge was.
 */
export function EvLiveTiles({
  deviceId,
  initial,
  ratedKw,
  charging,
  session,
  lastCharge,
}: {
  deviceId: string;
  initial: { kw: number | null; a: number | null; v: number | null; registerKwh: number | null };
  ratedKw: number | null;
  charging: boolean;
  session: LiveSession | null;
  lastCharge: string | null;
}) {
  const u = useUnits();
  const n = useLiveNumbers([deviceId], KEYS, { power_active_import_kw: initial.kw, current_import_l1_a: initial.a, voltage_l1_n_v: initial.v, energy_active_import_register_kwh: initial.registerKwh });
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const kw = charging ? n.power_active_import_kw : null;
  const a = charging ? n.current_import_l1_a : null;
  const v = charging ? n.voltage_l1_n_v : null;
  const f = evLiveFigures({
    kw,
    registerKwh: n.energy_active_import_register_kwh,
    startKwh: session?.startKwh ?? null,
    ratedKw,
    targetKwh: session?.targetKwh ?? null,
    startedAt: session?.startedAt ?? null,
    charging: charging && session !== null,
    now,
  });
  const dash = "—";
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Tile
        label="Power"
        value={kw === null ? dash : u.format(kw, "kW", null, 1, false)}
        unit={kw === null ? undefined : u.unit("kW")}
        bar={f.powerPct === null ? null : { pct: f.powerPct, color: FLOW.producing }}
        sub={charging ? (ratedKw ? `of ${u.format(ratedKw, "kW", null, 1)} rated` : undefined) : (lastCharge ?? "Not charging")}
      />
      <Tile label="Current" value={a === null ? dash : a.toFixed(1)} unit={a === null ? undefined : "A"} sub={v === null ? undefined : `${v.toFixed(0)} V`} />
      <Tile
        label="This charge"
        value={f.sessionKwh === null ? dash : u.format(f.sessionKwh, "kWh", null, 1, false)}
        unit={f.sessionKwh === null ? undefined : u.unit("kWh")}
        bar={f.progressPct === null ? null : { pct: f.progressPct, color: FLOW.consuming }}
        sub={f.progressPct !== null && session?.targetKwh ? `${Math.round(f.progressPct)}% of the ${session.targetKwh} kWh target` : charging ? "No target set" : undefined}
      />
      <Tile label="Time" value={f.elapsedMin === null ? dash : minutesText(f.elapsedMin)} sub={f.remainingMin === null ? undefined : `about ${minutesText(f.remainingMin)} left`} />
      <Tile
        label="Powered by"
        value={session?.solarPct == null || !charging ? dash : `${Math.round(session.solarPct)}`}
        unit={session?.solarPct == null || !charging ? undefined : "% solar"}
        split={charging && session?.shares ? session.shares.filter((x) => x.pct > 0) : null}
        sub={charging && !session?.shares ? "Shown when the charge ends" : undefined}
      />
    </div>
  );
}

function Tile({
  label,
  value,
  unit,
  sub,
  bar,
  split,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  bar?: { pct: number; color: string } | null;
  split?: SourceShare[] | null;
}) {
  return (
    <div className="min-w-0 rounded-xl border bg-muted/30 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-2xl font-semibold tabular-nums leading-tight">
        {value}
        {unit ? <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span> : null}
      </p>
      {bar ? (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-border" role="presentation">
          <div className="h-full rounded-full" style={{ width: `${bar.pct}%`, backgroundColor: bar.color }} />
        </div>
      ) : null}
      {split && split.length > 0 ? (
        <div className="mt-2 flex h-1 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={split.map((x) => `${x.label} ${x.pct.toFixed(0)}%`).join(", ")}>
          {split.map((x) => (
            <div key={x.key} style={{ width: `${x.pct}%`, backgroundColor: SHARE_COLOR[x.key] }} />
          ))}
        </div>
      ) : null}
      {sub ? <p className="mt-1.5 truncate text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}
