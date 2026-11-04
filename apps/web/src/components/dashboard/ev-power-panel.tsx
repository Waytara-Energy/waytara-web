"use client";

import * as React from "react";
import { Loader2, Power } from "lucide-react";
import { parseTarget } from "@/lib/ev-control";
import { cn } from "@/lib/utils";
import { useEvCharge } from "./ev-charge-control";

const PRESETS_KWH = [5, 10, 20, 30];

function Chip({ selected, invalid = false, onClick, children, label }: { selected: boolean; invalid?: boolean; onClick: () => void; children: React.ReactNode; label?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "h-9 rounded-full border px-3.5 text-sm font-medium tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
        invalid && "border-destructive text-destructive",
      )}
    >
      {children}
    </button>
  );
}

/**
 * The foot of a charger's hero: on the right a round power button (press to start, press again to stop); on the left either the figures of the
 * charge that is running (`stats`, given by the page) or, before one has started, the choice of how many kWh to stop after (one press on a
 * number, or Other for any number; no choice means no limit).
 *   charging  a charge is on (the figures show instead of the choice)
 */
export function EvPowerPanel({
  chargerId,
  sessionOpen,
  transactionId,
  connected,
  charging,
  stats,
}: {
  chargerId: string;
  sessionOpen: boolean;
  transactionId: number | null;
  connected: boolean | null;
  charging: boolean;
  stats: React.ReactNode;
}) {
  const { busy, waiting, error, pending, start, stop } = useEvCharge({ chargerId, sessionOpen, transactionId });
  const [preset, setPreset] = React.useState<number | null>(null);
  const [other, setOther] = React.useState(false);
  const [text, setText] = React.useState("");
  const typed = parseTarget(text);
  const bad = other && text.trim() !== "" && !typed.ok;
  const target = other ? (typed.ok ? typed.kwh : null) : preset;

  const on = sessionOpen || charging;
  const offline = connected === false;
  const stopping = busy === "stop";
  const starting = busy === "start" || waiting;
  const disabledLook = !on && (offline || bad);
  const label = on ? (stopping ? "Stopping…" : "Stop charging") : starting ? "Starting…" : offline ? "Charger offline" : "Start charging";

  return (
    <div className="flex w-full items-end justify-between gap-4">
      <div className="min-w-0 flex-1">
        {on ? (
          stats
        ) : offline ? (
          <p className="text-sm text-muted-foreground">The charger is not connected right now.</p>
        ) : (
          <div role="group" aria-label="Stop after" className="flex flex-wrap items-center gap-2">
            <Chip selected={target === null && !bad} onClick={() => { setPreset(null); setOther(false); setText(""); }}>
              No limit
            </Chip>
            {PRESETS_KWH.map((kwh) => (
              <Chip key={kwh} selected={!other && preset === kwh} onClick={() => { setOther(false); setPreset(preset === kwh ? null : kwh); }} label={`Stop after ${kwh} kWh`}>
                {kwh} kWh
              </Chip>
            ))}
            {other ? (
              <label className={cn("flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm tabular-nums", bad ? "border-destructive text-destructive" : "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300")}>
                <input
                  autoFocus
                  inputMode="decimal"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="0"
                  aria-label="Stop after this many kWh"
                  className="w-12 bg-transparent text-right font-medium outline-none placeholder:text-current/50"
                />
                kWh
              </label>
            ) : (
              <Chip selected={false} onClick={() => { setOther(true); setPreset(null); }}>
                Other
              </Chip>
            )}
          </div>
        )}
        {error ? (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      {/* A hardware-style power button: a dark bezel, a black groove and a domed cap, with the symbol glowing on it. Green while the charger is
          ready (press to start), red while it charges (press to stop), dull when it cannot be used. */}
      <button
        type="button"
        aria-pressed={on}
        aria-label={label}
        title={label}
        disabled={stopping || starting || (!on && (offline || bad))}
        onClick={() => (on ? void stop() : void start(target))}
        style={{ background: "linear-gradient(150deg,#5a5a5a 0%,#1c1c1c 55%,#2e2e2e 100%)", boxShadow: "0 8px 16px rgb(0 0 0/0.3), inset 0 1px 1px rgb(255 255 255/0.3)" }}
        className="group relative grid size-20 shrink-0 place-items-center rounded-full outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background enabled:active:scale-95 disabled:cursor-not-allowed"
      >
        {/* the black groove */}
        <span aria-hidden="true" className="absolute inset-[6px] rounded-full bg-[#0b0b0b]" style={{ boxShadow: "inset 0 2px 4px rgb(0 0 0/0.8)" }} />
        {/* the domed cap */}
        <span
          aria-hidden="true"
          className="absolute inset-[10px] rounded-full transition-[filter] group-enabled:group-active:brightness-75"
          style={{ background: "radial-gradient(circle at 50% 25%,#7a7a7a 0%,#444 45%,#262626 100%)", boxShadow: "inset 0 1px 2px rgb(255 255 255/0.35), 0 1px 3px rgb(0 0 0/0.6)" }}
        />
        {pending ? (
          <Loader2 className="relative size-8 animate-spin text-zinc-300" />
        ) : (
          <Power
            className={cn("relative size-9 transition-colors", disabledLook ? "text-zinc-500" : on ? "text-red-500" : "text-green-500")}
            strokeWidth={2.5}
            style={disabledLook ? undefined : { filter: `drop-shadow(0 0 6px ${on ? "rgb(239 68 68/0.85)" : "rgb(34 197 94/0.85)"})` }}
          />
        )}
      </button>
    </div>
  );
}
