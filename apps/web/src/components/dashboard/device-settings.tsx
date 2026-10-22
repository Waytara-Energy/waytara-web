"use client";

import * as React from "react";
import { AlertTriangle, Check, Clock } from "lucide-react";
import { withPromiseToast } from "@waytara/ui/notify";
import { useRealtimeTable } from "@waytara/ui/realtime-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { updateInstrumentSetting } from "@/app/dashboard/devices/actions";
import type { ConfigLogRow, EnumOption, SettingField } from "@/lib/instrument-catalog-data";
import { parseBool, settingStatus, toShownValue, toStoredValue, type ConfigRow, type SettingStatus } from "@/lib/setting-values";
import { cn } from "@/lib/utils";
import { DeviceCard } from "./device-card";
import { UnitConverterIcon } from "./unit-converter";

interface ConfigInsert {
  key_name: string;
  setting_value: string;
  previous_value?: string | null;
  notes?: string | null;
  source: string | null;
  ts: string;
}

const isAgent = (source: string | null) => (source ?? "").startsWith("agent");

interface Ctx {
  deviceId: string;
  status: (field: SettingField) => SettingStatus;
  /** Shows a request at once (before the server has it) and takes it back if saving fails. */
  request: (key: string, stored: string) => () => void;
  enumOptions: Record<string, EnumOption[]>;
  /** When the agent last read any of these settings from the inverter (ISO), or null. */
  lastRead: string | null;
  /** The settings log, newest first. */
  log: ConfigLogRow[];
}
const SettingsContext = React.createContext<Ctx | null>(null);
export const useSettings = () => {
  const ctx = React.useContext(SettingsContext);
  if (!ctx) throw new Error("Settings components must sit inside <SettingsProvider>.");
  return ctx;
};

/** Holds the settings of one device and keeps them current: every value follows the device's own rows as they arrive (no refresh). What
 *  the agent read from the inverter is the truth; a change you ask for shows as waiting until the inverter reads it back. */
export function SettingsProvider({ deviceId, fields, enumOptions, log: initialLog, children }: { deviceId: string; fields: SettingField[]; enumOptions: Record<string, EnumOption[]>; log: ConfigLogRow[]; children: React.ReactNode }) {
  const [log, setLog] = React.useState(initialLog);
  // key -> its newest agent row and newest request row
  const [rows, setRows] = React.useState<Record<string, { agent?: ConfigRow; request?: ConfigRow }>>(() => {
    const out: Record<string, { agent?: ConfigRow; request?: ConfigRow }> = {};
    for (const f of fields) {
      const e: { agent?: ConfigRow; request?: ConfigRow } = {};
      for (const r of f.recent) {
        if (isAgent(r.source)) e.agent = r;
        else e.request = r;
      }
      out[f.key] = e;
    }
    return out;
  });

  const apply = React.useCallback((r: ConfigInsert) => {
    const row: ConfigRow = { value: r.setting_value, source: r.source, ts: r.ts };
    setRows((prev) => ({ ...prev, [r.key_name]: { ...prev[r.key_name], ...(isAgent(r.source) ? { agent: row } : { request: row }) } }));
    // Start-up reads are not part of the log; everything else is, as it arrives.
    if (r.source !== "agent_initial_read") {
      const line: ConfigLogRow = { key: r.key_name, value: r.setting_value, previous: r.previous_value ?? null, source: r.source, notes: r.notes ?? null, ts: r.ts };
      setLog((prev) => (prev.some((l) => l.ts === line.ts && l.key === line.key && l.source === line.source) ? prev : [line, ...prev].slice(0, 200)));
    }
  }, []);
  useRealtimeTable<ConfigInsert>("equipment_configs", "INSERT", `equipment_id=eq.${deviceId}`, (p) => apply(p.new));

  const ctx = React.useMemo<Ctx>(
    () => ({
      deviceId,
      status: (f) => {
        const e = rows[f.key] ?? {};
        return settingStatus([e.agent, e.request].filter((x): x is ConfigRow => !!x).sort((a, b) => a.ts.localeCompare(b.ts)), f.valueKind);
      },
      request: (key, stored) => {
        const before = rows[key]?.request;
        setRows((prev) => ({ ...prev, [key]: { ...prev[key], request: { value: stored, source: "customer_dashboard", ts: new Date().toISOString() } } }));
        return () => setRows((prev) => ({ ...prev, [key]: { ...prev[key], request: before } }));
      },
      enumOptions,
      log,
      lastRead: Object.values(rows).map((e) => e.agent?.ts).filter((t): t is string => !!t).sort().at(-1) ?? null,
    }),
    [rows, enumOptions, deviceId, log]
  );
  return <SettingsContext.Provider value={ctx}>{children}</SettingsContext.Provider>;
}

/** True when any of these settings is waiting for the inverter or was not taken (for the dot beside a menu item). */
export function useNeedsAttention(fields: SettingField[]): boolean {
  const ctx = useSettings();
  return fields.some((f) => ["pending", "mismatch"].includes(ctx.status(f).state));
}

/** How the settings stand, for the headline: how many are waiting for the inverter, how many it did not take, and when it last read them. */
export function useSettingsSummary(fields: SettingField[]): { total: number; waiting: number; notTaken: number; lastRead: string | null } {
  const ctx = useSettings();
  let waiting = 0;
  let notTaken = 0;
  for (const f of fields) {
    const state = ctx.status(f).state;
    if (state === "pending") waiting += 1;
    else if (state === "mismatch") notTaken += 1;
  }
  return { total: fields.length, waiting, notTaken, lastRead: ctx.lastRead };
}

/** One page of settings, as cards in the page's own style: each block of the inverter's screen is a card of rows. Time of use is a card
 *  with a table instead of 44 rows. */
export function SettingsPane({ fields }: { fields: SettingField[] }) {
  const byGroup = new Map<string, SettingField[]>();
  for (const f of [...fields].sort((a, b) => a.sectionOrder - b.sectionOrder)) byGroup.set(f.section, [...(byGroup.get(f.section) ?? []), f]);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {[...byGroup.entries()].map(([name, list]) => {
          const isSchedule = name === "Time of use";
          return (
            <DeviceCard key={name} title={name} className={isSchedule ? "lg:col-span-2" : undefined}>
              {isSchedule ? (
                <TimeOfUse fields={list} />
              ) : (
                <div>
                  {list.map((f) => (
                    <SettingRow key={f.key} field={f} />
                  ))}
                </div>
              )}
            </DeviceCard>
          );
        })}
      </div>
      <SettingsLog fields={fields} />
    </div>
  );
}

const LOG_FIRST = 8;

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

/** What a line of the log says, in words a customer can read: who did it, what it was set to, and how the inverter answered. */
function logLine(row: ConfigLogRow, field: SettingField, enums: Record<string, EnumOption[]>) {
  const shown = (v: string | null) => display(field, v, enums);
  if (row.source === "agent_write_ok") return { who: "Inverter", change: `Now ${shown(row.value)}`, result: "Confirmed", tone: "good" as const };
  if (row.source === "agent_write_failed") return { who: "Inverter", change: row.previous ? `Asked for ${shown(row.previous)}, still ${shown(row.value)}` : `Still ${shown(row.value)}`, result: row.notes ? `Not taken: ${row.notes}` : "Not taken", tone: "bad" as const };
  if (row.source === "customer_dashboard") return { who: "You", change: `Set to ${shown(row.value)}`, result: "Sent to the inverter", tone: "neutral" as const };
  return { who: "WayTara", change: `Set to ${shown(row.value)}`, result: "Sent to the inverter", tone: "neutral" as const };
}

/** The change log of this page's settings: every change asked for (by you or WayTara) and what the inverter answered, newest first. Follows
 *  new rows live. Start-up reads are not listed. */
function SettingsLog({ fields }: { fields: SettingField[] }) {
  const ctx = useSettings();
  const [all, setAll] = React.useState(false);
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const lines = ctx.log.filter((l) => byKey.has(l.key));
  const shown = all ? lines : lines.slice(0, LOG_FIRST);
  return (
    <DeviceCard title="Change log" description="Every change asked for on this page and what the inverter answered, newest first.">
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">No changes yet. When a setting is changed, it is listed here with the inverter&apos;s answer.</p>
      ) : (
        <>
          <ul className="divide-y divide-border/60">
            {shown.map((l) => {
              const field = byKey.get(l.key)!;
              const line = logLine(l, field, ctx.enumOptions);
              return (
                <li key={`${l.ts}-${l.key}-${l.source}`} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 py-2.5 text-sm first:pt-0 last:pb-0">
                  <span className="w-28 shrink-0 text-xs tabular-nums text-muted-foreground">{when(l.ts)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-foreground">{field.name}</span>
                    <span className="text-muted-foreground"> · {line.who} · {line.change}</span>
                  </span>
                  <span className={cn("shrink-0 text-xs font-medium", line.tone === "good" ? "text-emerald-600 dark:text-emerald-400" : line.tone === "bad" ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>{line.result}</span>
                </li>
              );
            })}
          </ul>
          {lines.length > LOG_FIRST && (
            <Button type="button" variant="ghost" size="sm" className="mt-3 h-8 px-2 text-xs" onClick={() => setAll((v) => !v)}>
              {all ? "Show fewer" : `Show all ${lines.length}`}
            </Button>
          )}
        </>
      )}
    </DeviceCard>
  );
}

function rangeHint(field: SettingField): string | null {
  const u = field.unit ? ` ${field.unit}` : "";
  if (field.validMin !== null && field.validMax !== null) return `${field.validMin} to ${field.validMax}${u}`;
  if (field.validMin !== null) return `At least ${field.validMin}${u}`;
  if (field.validMax !== null) return `At most ${field.validMax}${u}`;
  return null;
}

function SettingRow({ field }: { field: SettingField }) {
  const hint = rangeHint(field);
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-2 border-b border-border/60 py-3.5 first:pt-0 last:border-b-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">
          {field.name}
          {field.unit && field.valueKind !== "bool" ? <span className="font-normal text-muted-foreground"> · {field.unit}</span> : null}
          {field.valueKind === "number" && <UnitConverterIcon unit={field.unit} />}
        </p>
        {hint && field.valueKind === "number" && <p className="text-xs text-muted-foreground">{hint}</p>}
        <StatusLine field={field} />
      </div>
      <SettingControl field={field} />
    </div>
  );
}

/** What the page knows about this value, in a line: nothing when it came from the inverter, otherwise what is waiting or wrong. */
function StatusLine({ field }: { field: SettingField }) {
  const ctx = useSettings();
  const s = ctx.status(field);
  if (s.state === "confirmed") return null;
  if (s.state === "pending")
    return (
      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
        <Clock className="size-3" />
        Waiting for the inverter to confirm
      </p>
    );
  if (s.state === "mismatch")
    return (
      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
        <AlertTriangle className="size-3" />
        The inverter did not take this change. It shows {display(field, s.deviceValue, ctx.enumOptions)}.
      </p>
    );
  return <p className="mt-0.5 text-xs text-muted-foreground">Not read from the inverter yet</p>;
}

function display(field: SettingField, stored: string | null, enums: Record<string, EnumOption[]>): string {
  if (stored === null) return "no value";
  if (field.valueKind === "bool") return parseBool(stored) ? "on" : "off";
  if (field.valueKind === "enum") return enums[field.enumRef ?? ""]?.find((o) => o.code === stored)?.label ?? stored;
  return toShownValue(field.valueKind, stored) + (field.unit ? ` ${field.unit}` : "");
}

/** The input for one setting. On/off and choices save when changed; numbers and times save with Enter, the button or leaving the box. */
function SettingControl({ field, compact = false }: { field: SettingField; compact?: boolean }) {
  const ctx = useSettings();
  const status = ctx.status(field);
  const shown = toShownValue(field.valueKind, status.value);
  const [draft, setDraft] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const value = draft ?? shown;
  const id = `setting-${field.key}`;

  function save(next: string) {
    const stored = toStoredValue(field.valueKind, next);
    const undo = ctx.request(field.key, stored);
    setDraft(null);
    startTransition(async () => {
      const ok = await withPromiseToast(updateInstrumentSetting.bind(null, ctx.deviceId, field.key), { loading: `Saving ${field.name}…`, success: `${field.name} sent to the inverter.` })(stored);
      if (!ok) undo();
    });
  }

  if (field.valueKind === "bool")
    return (
      <div className="flex items-center gap-2">
        {pending && <Spinner className="size-3.5 text-muted-foreground" />}
        <Switch id={id} aria-label={field.name} checked={parseBool(shown) === true} disabled={pending} onCheckedChange={(on) => save(on ? "true" : "false")} />
      </div>
    );

  if (field.valueKind === "enum")
    return (
      <div className="flex items-center gap-2">
        {pending && <Spinner className="size-3.5 text-muted-foreground" />}
        <Select value={value || undefined} disabled={pending} onValueChange={save}>
          <SelectTrigger id={id} aria-label={field.name} className="w-56">
            <SelectValue placeholder="Not read yet" />
          </SelectTrigger>
          <SelectContent>
            {(ctx.enumOptions[field.enumRef ?? ""] ?? []).map((o) => (
              <SelectItem key={o.code} value={o.code}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );

  const dirty = draft !== null && draft !== shown && draft.trim() !== "";
  return (
    <div className="flex items-center gap-2">
      <Input
        id={id}
        aria-label={field.name}
        type={field.valueKind === "number" ? "number" : field.valueKind === "time" ? "time" : "text"}
        min={field.validMin ?? undefined}
        max={field.validMax ?? undefined}
        value={value}
        disabled={pending}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && dirty && save(draft!)}
        onBlur={() => dirty && save(draft!)}
        className={cn("h-9", compact ? "w-24" : "w-32")}
      />
      {!compact && (
        <Button type="button" size="sm" variant="outline" disabled={pending || !dirty} onClick={() => dirty && save(draft!)} className="h-9 gap-1.5">
          {pending ? <Spinner className="size-3.5" /> : <Check className="size-3.5" />}
          Save
        </Button>
      )}
    </div>
  );
}

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const SLOT_COLUMNS: { suffix: string; label: string }[] = [
  { suffix: "start_time", label: "Starts" },
  { suffix: "power_w", label: "Power (W)" },
  { suffix: "battery_soc_pct", label: "Battery to (%)" },
  { suffix: "battery_voltage_v", label: "Battery to (V)" },
  { suffix: "grid_charge_enabled", label: "Grid charge" },
  { suffix: "generator_charge_enabled", label: "Generator charge" },
];

/** Time of Use: one switch for the schedule, a button for each weekday, and the six time slots as a table. */
function TimeOfUse({ fields }: { fields: SettingField[] }) {
  const ctx = useSettings();
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const master = byKey.get("time_of_use_enabled");
  const slots = [1, 2, 3, 4, 5, 6].filter((n) => SLOT_COLUMNS.some((c) => byKey.has(`time_of_use_slot${n}_${c.suffix}`)));
  const columns = SLOT_COLUMNS.filter((c) => slots.some((n) => byKey.has(`time_of_use_slot${n}_${c.suffix}`)));
  return (
    <div>
      {master && (
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-2 border-b border-border/60 pb-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Run the schedule</p>
            <p className="text-xs text-muted-foreground">What the inverter does at different times of day, for the days you choose.</p>
            <StatusLine field={master} />
          </div>
          <SettingControl field={master} />
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 py-4">
        <p className="text-sm font-medium text-foreground">Days</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Days the schedule runs">
          {DAYS.map((d) => {
            const f = byKey.get(`time_of_use_${d}_enabled`);
            return f ? <DayToggle key={d} field={f} label={d.slice(0, 3)} /> : null;
          })}
        </div>
      </div>
      <div className="overflow-x-auto pt-4">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="pb-2 pr-3 font-medium">Slot</th>
              {columns.map((c) => (
                <th key={c.suffix} className="pb-2 pr-3 font-medium">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {slots.map((n) => (
              <tr key={n}>
                <td className="py-2 pr-3 font-medium text-foreground">{n}</td>
                {columns.map((c) => {
                  const f = byKey.get(`time_of_use_slot${n}_${c.suffix}`);
                  const st = f ? ctx.status(f).state : null;
                  return (
                    <td key={c.suffix} className="py-2 pr-3">
                      {f ? (
                        <span className={cn("inline-flex rounded-md", st === "pending" && "ring-1 ring-amber-500/60", st === "mismatch" && "ring-1 ring-red-500/60")} title={st === "pending" ? "Waiting for the inverter to confirm" : st === "mismatch" ? "The inverter did not take this change" : undefined}>
                          <SettingControl field={f} compact />
                        </span>
                      ) : (
                        <span className="text-muted-foreground">·</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DayToggle({ field, label }: { field: SettingField; label: string }) {
  const ctx = useSettings();
  const status = ctx.status(field);
  const on = parseBool(status.value) === true;
  const [pending, startTransition] = React.useTransition();
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={pending}
      onClick={() => {
        const stored = on ? "false" : "true";
        const undo = ctx.request(field.key, stored);
        startTransition(async () => {
          const ok = await withPromiseToast(updateInstrumentSetting.bind(null, ctx.deviceId, field.key), { loading: `Saving ${field.name}…`, success: `${field.name} sent to the inverter.` })(stored);
          if (!ok) undo();
        });
      }}
      className={cn(
        "h-8 min-w-12 rounded-md border px-3 text-xs font-medium capitalize outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60",
        on ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "border-border text-muted-foreground hover:bg-muted/60",
        status.state === "pending" && "ring-1 ring-amber-500/60"
      )}
    >
      {label}
    </button>
  );
}
