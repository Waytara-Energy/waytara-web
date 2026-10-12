"use client";

import * as React from "react";
import { CheckCircle2 } from "lucide-react";

export interface PincodeInfo {
  status: "idle" | "loading" | "found" | "missing";
  city: string | null;
  state: string | null;
}

const IDLE: PincodeInfo = { status: "idle", city: null, state: null };

/** The city and state of a PIN code, looked up once six digits are typed. A lookup that fails is the same as nothing found: the form works
 *  without it. */
export function usePincode(pincode: string): PincodeInfo {
  const pin = pincode.trim();
  const [info, setInfo] = React.useState<PincodeInfo & { pin: string }>({ ...IDLE, pin: "" });
  React.useEffect(() => {
    if (!/^[1-9]\d{5}$/.test(pin)) return;
    const controller = new AbortController();
    void (async () => {
      setInfo({ status: "loading", city: null, state: null, pin });
      try {
        const res = await fetch(`/api/pincode?pin=${pin}`, { signal: controller.signal });
        const body = (await res.json()) as { city?: string | null; state?: string | null };
        setInfo(body.city || body.state ? { status: "found", city: body.city ?? null, state: body.state ?? null, pin } : { status: "missing", city: null, state: null, pin });
      } catch (e) {
        if ((e as Error).name !== "AbortError") setInfo({ status: "missing", city: null, state: null, pin });
      }
    })();
    return () => controller.abort();
  }, [pin]);
  // A result belongs to the PIN it was looked up for; once the digits change it no longer applies.
  return info.pin === pin ? info : IDLE;
}

/** The line under the PIN code field: where that PIN code is. */
export function PincodeHint({ info }: { info: PincodeInfo }) {
  if (info.status === "found")
    return (
      <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-3" />
        {[info.city, info.state].filter(Boolean).join(", ")}
      </p>
    );
  if (info.status === "loading") return <p className="mt-1 text-[11px] text-theme-muted">Checking…</p>;
  return null;
}
