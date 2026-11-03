"use client";

import { CarFront } from "lucide-react";
import { useLiveNumbers } from "@/lib/telemetry/live-values";
import { useUnits } from "@/components/units-provider";
import { cn } from "@/lib/utils";
import { EvChargeControl } from "./ev-charge-control";

/**
 * The middle of a charger's Overview: a circle for the charger with what it is doing in words (Available, Charging, Offline, ...), the live
 * power while a charge runs (or today's energy when none does), and the Start / Stop charging control. The cards on either side are
 * EvLiveCards. The state words and the open charge come from the server (the page refreshes when a session starts or ends); the power is live.
 */
export function EvChargerHub({
  chargerId,
  initialPowerKw,
  status,
  connected,
  todayKwh,
  open,
}: {
  chargerId: string;
  initialPowerKw: number | null;
  /** The connector's status in words ("Available", "Charging", "Offline"...), or null when not known yet. */
  status: string | null;
  /** The charger answers through its unit (null = no verdict yet). */
  connected: boolean | null;
  todayKwh: number | null;
  /** The charge that is open right now, if one is. */
  open: { transactionId: number | null; kwh: number | null } | null;
}) {
  const n = useLiveNumbers([chargerId], ["power_active_import_kw"], { power_active_import_kw: initialPowerKw }, () => "sum");
  const u = useUnits();
  const powerKw = n.power_active_import_kw;
  const offline = connected === false;
  const charging = !offline && (open !== null || (powerKw ?? 0) > 0);
  const word = offline ? "Offline" : charging ? "Charging" : (status ?? "Available");

  const detail = offline
    ? "Not connected right now"
    : charging
      ? [powerKw !== null && powerKw > 0 ? u.format(powerKw, "kW", "power_active_import_kw", 2) : "Starting…", open?.kwh != null ? `${u.format(open.kwh, "kWh", "ev_energy_today_kwh", 1)} this charge` : null].filter(Boolean).join(" · ")
      : todayKwh !== null && todayKwh > 0
        ? `${u.format(todayKwh, "kWh", "ev_energy_today_kwh", 1)} delivered today`
        : "No charge yet today";

  return (
    <div className="flex flex-col items-center justify-center gap-5 py-6 text-center lg:min-h-[22rem]">
      <div
        className={cn(
          "relative grid size-40 place-items-center rounded-full border-2 bg-card transition-colors",
          offline ? "border-red-400/60 text-red-500" : charging ? "border-emerald-500 text-emerald-600 dark:text-emerald-400" : "border-border text-muted-foreground",
        )}
      >
        {charging && <span aria-hidden="true" className="absolute -inset-2 rounded-full border border-emerald-500/40 motion-safe:animate-pulse" />}
        <CarFront className="size-16" strokeWidth={1.4} aria-hidden="true" />
      </div>
      <div>
        <p className={cn("text-xl font-semibold", offline ? "text-red-600 dark:text-red-400" : charging ? "text-emerald-600 dark:text-emerald-400" : "text-foreground")}>{word}</p>
        <p className="mt-1 text-sm text-muted-foreground tabular-nums">{detail}</p>
      </div>
      <EvChargeControl chargerId={chargerId} sessionOpen={open !== null} transactionId={open?.transactionId ?? null} connected={connected} className="w-full max-w-[16rem]" />
    </div>
  );
}
