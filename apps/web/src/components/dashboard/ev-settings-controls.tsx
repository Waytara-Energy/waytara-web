"use client";

import * as React from "react";
import { Loader2, LockOpen, RotateCcw } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { callHub } from "./ev-charge-control";

type Action = { id: "unlock" | "soft" | "hard"; label: string; title: string; text: string; run: (chargerId: string) => ReturnType<typeof callHub> };

const ACTIONS: Action[] = [
  {
    id: "unlock",
    label: "Unlock connector",
    title: "Unlock the connector?",
    text: "The charger releases the cable at its connector. Use it when the plug is stuck. A charge that is running will stop.",
    run: (id) => callHub(`/v1/ev/${encodeURIComponent(id)}/unlock`, { connector_id: 1 }),
  },
  {
    id: "soft",
    label: "Restart (soft)",
    title: "Restart the charger?",
    text: "The charger ends any charge, restarts its software and reconnects in about a minute.",
    run: (id) => callHub(`/v1/ev/${encodeURIComponent(id)}/reset`, { type: "Soft" }),
  },
  {
    id: "hard",
    label: "Restart (hard)",
    title: "Restart the charger the hard way?",
    text: "The charger ends any charge and power-cycles itself. Use it only when a soft restart did not help.",
    run: (id) => callHub(`/v1/ev/${encodeURIComponent(id)}/reset`, { type: "Hard" }),
  },
];

/** Unlock connector and Restart (soft / hard) for one charger. Each asks first, then goes to the service with the signed-in person's pass; the answer
 *  is the charger's own ("did not accept it (NotSupported)") or the service's plain reason (the charger is not connected, and so on). */
export function EvSettingsControls({ chargerId }: { chargerId: string }) {
  const [busy, setBusy] = React.useState<Action["id"] | null>(null);
  const [result, setResult] = React.useState<{ ok: boolean; text: string } | null>(null);

  async function run(a: Action) {
    setBusy(a.id);
    setResult(null);
    const r = await a.run(chargerId);
    setBusy(null);
    setResult(r.ok ? { ok: true, text: `${a.label}: the charger accepted it.` } : { ok: false, text: r.message });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((a) => (
          <AlertDialog key={a.id}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={busy !== null}>
                {busy === a.id ? <Loader2 className="size-4 animate-spin" /> : a.id === "unlock" ? <LockOpen className="size-4" /> : <RotateCcw className="size-4" />}
                {a.label}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{a.title}</AlertDialogTitle>
                <AlertDialogDescription>{a.text}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => void run(a)}>{a.label}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ))}
      </div>
      {result ? (
        <p role={result.ok ? "status" : "alert"} className={result.ok ? "text-sm text-emerald-600 dark:text-emerald-400" : "text-sm text-destructive"}>
          {result.text}
        </p>
      ) : null}
    </div>
  );
}
