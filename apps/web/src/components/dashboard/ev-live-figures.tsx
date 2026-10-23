"use client";

import { useLiveNumbers } from "@/lib/telemetry/live-values";
import { useUnits } from "@/components/units-provider";

const KEYS = ["power_active_import_kw", "current_import_l1_a", "voltage_l1_n_v"];

/** The charger's power, current and voltage right now, kept live from the device's channel (the server's numbers are shown until the first live one). */
export function EvLiveFigures({ deviceId, initial, charging }: { deviceId: string; initial: { kw: number | null; a: number | null; v: number | null }; charging: boolean }) {
  const u = useUnits();
  const n = useLiveNumbers([deviceId], KEYS, { power_active_import_kw: initial.kw, current_import_l1_a: initial.a, voltage_l1_n_v: initial.v });
  const kw = n.power_active_import_kw;
  const a = n.current_import_l1_a;
  const v = n.voltage_l1_n_v;
  const shown = (x: number | null) => (charging && x !== null ? x : null);
  return (
    <dl className="flex flex-wrap items-end gap-x-8 gap-y-2">
      <Figure label="Power" value={shown(kw) === null ? "—" : u.format(kw as number, "kW", null, 1, false)} unit={u.unit("kW")} />
      <Figure label="Current" value={shown(a) === null ? "—" : (a as number).toFixed(1)} unit="A" />
      <Figure label="Voltage" value={shown(v) === null ? "—" : (v as number).toFixed(0)} unit="V" />
    </dl>
  );
}

function Figure({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums leading-tight">
        {value}
        {value !== "—" ? <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span> : null}
      </dd>
    </div>
  );
}
