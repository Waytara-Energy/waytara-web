"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, Square } from "lucide-react";
import { createClient } from "@waytara/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { START_POLL_MS, START_WAIT_MS, hubMessage, parseTarget, startBody } from "@/lib/ev-control";

/** The WayTara service that tells the charger (through its monitoring unit) to start and stop. */
const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "https://hub.waytaraenergy.com";

async function callHub(path: string, body: unknown): Promise<{ ok: true } | { ok: false; message: string }> {
  const token = (await createClient().auth.getSession()).data.session?.access_token;
  if (!token) return { ok: false, message: hubMessage(401) };
  let res: Response;
  try {
    res = await fetch(`${GATEWAY_URL.replace(/\/+$/, "")}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return { ok: false, message: hubMessage(0) };
  }
  if (res.ok) {
    // the charger can say "Rejected" or "NotSupported" in a 200 answer: that is a refusal too
    try {
      const j = (await res.json()) as { status?: string };
      if (typeof j.status === "string" && j.status !== "Accepted") return { ok: false, message: `The charger did not accept it (${j.status}).` };
    } catch {
      /* no body: fine */
    }
    return { ok: true };
  }
  let said: string | null = null;
  try {
    const j = (await res.json()) as { error?: { message?: string } };
    if (typeof j.error?.message === "string") said = j.error.message;
  } catch {
    /* no body */
  }
  return { ok: false, message: hubMessage(res.status, said) };
}

/**
 * Start / Stop for one EV charger. With no charge open it is a "Start charging" button (and, unless `compact`, a small "stop after N kWh" field); with
 * a charge open it is a "Stop" button. Both go to the WayTara service with the signed-in person's pass; the charger starts a few seconds later, so after a
 * start the page asks the server again every few seconds until the charge shows up.
 *   sessionOpen    a charging session is open for this charger
 *   transactionId  the charger's own number for it (ev_sessions.ocpp_transaction_id): Stop needs it
 *   connected      the charger answers through its unit (null = not known); a charger that is not connected cannot be started
 */
export function EvChargeControl({
  chargerId,
  sessionOpen,
  transactionId,
  connected,
  compact = false,
  className,
}: {
  chargerId: string;
  sessionOpen: boolean;
  transactionId: number | null;
  connected: boolean | null;
  compact?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<"start" | "stop" | null>(null);
  const [waiting, setWaiting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [target, setTarget] = React.useState("");
  const waitingSince = React.useRef(0);

  // The charge began (or ended): no longer waiting for it.
  const [seenOpen, setSeenOpen] = React.useState(sessionOpen);
  if (seenOpen !== sessionOpen) {
    setSeenOpen(sessionOpen);
    setWaiting(false);
    setBusy(null);
  }

  // After a start: look again every few seconds until the charge appears, for at most half a minute.
  React.useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => {
      if (Date.now() - waitingSince.current > START_WAIT_MS) {
        setWaiting(false);
        setError("The charger accepted the start but no charge has begun. Is the car plugged in?");
        return;
      }
      router.refresh();
    }, START_POLL_MS);
    return () => clearInterval(t);
  }, [waiting, router]);

  async function start() {
    const t = parseTarget(target);
    if (!t.ok) {
      setError("Type the units to charge as a number, for example 10 (or leave it empty).");
      return;
    }
    setError(null);
    setBusy("start");
    const r = await callHub(`/v1/ev/${encodeURIComponent(chargerId)}/remote-start`, startBody(t.kwh));
    if (!r.ok) {
      setBusy(null);
      setError(r.message);
      return;
    }
    waitingSince.current = Date.now();
    setWaiting(true);
    router.refresh();
  }

  async function stop() {
    if (transactionId === null) {
      setError("The charger has not given this charge a number yet. Try again in a few seconds.");
      return;
    }
    setError(null);
    setBusy("stop");
    const r = await callHub(`/v1/ev/${encodeURIComponent(chargerId)}/remote-stop`, { transaction_id: transactionId });
    if (!r.ok) {
      setBusy(null);
      setError(r.message);
      return;
    }
    router.refresh();
    // the session closes when the charger reports the stop: keep the pending look until the page shows it
    setTimeout(() => setBusy(null), 8_000);
  }

  const pending = busy !== null || waiting;
  return (
    <div className={cn("space-y-2", className)}>
      {sessionOpen ? (
        <Button type="button" variant="outline" size={compact ? "sm" : "lg"} className="w-full rounded-full" onClick={() => void stop()} disabled={busy === "stop"}>
          {busy === "stop" ? <Loader2 className="size-4 animate-spin" /> : <Square className="size-4" />}
          {busy === "stop" ? "Stopping…" : "Stop charging"}
        </Button>
      ) : (
        <>
          {!compact ? (
            <label className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>Stop after (kWh, optional)</span>
              <input
                inputMode="decimal"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="no limit"
                disabled={pending}
                className="h-8 w-24 rounded-md border bg-background px-2 text-right text-sm tabular-nums text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
          ) : null}
          <Button type="button" size={compact ? "sm" : "lg"} className="w-full rounded-full" onClick={() => void start()} disabled={pending || connected === false}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            {waiting ? "Starting…" : busy === "start" ? "Sending…" : "Start charging"}
          </Button>
          {connected === false ? <p className="text-center text-xs text-muted-foreground">The charger is not connected right now.</p> : null}
        </>
      )}
      {error ? (
        <p role="alert" className="text-center text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
