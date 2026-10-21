"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, PlugZap, Cpu, X } from "lucide-react";
import { createClient } from "@waytara/supabase/client";
import { KeysApiError, chargerAddress, createKeysClient, type IssuedKey } from "@waytara/cadence/keys";
import { Button } from "@waytara/ui/button";
import { notify } from "@waytara/ui/notify";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// A literal `process.env.NEXT_PUBLIC_*` so Next can put it into the browser bundle.
const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "https://hub.waytaraenergy.com";
const GATEWAY_HOST = GATEWAY_URL.replace(/^https?:\/\//, "").replace(/\/+$/, "");

export interface KeyDevice {
  id: string;
  site: string;
  name: string;
  model: string | null;
  isCharger: boolean;
  keys: { id: string; kind: "gateway" | "charger"; label: string | null; fingerprint: string; createdAt: string; lastUsedAt: string | null; expiresAt: string | null }[];
  /** a key change that is being delivered to the unit right now */
  keyChange: { state: "sent" | "staged"; startedAt: string; expiresAt: string } | null;
}

const when = (ts: string | null) =>
  ts ? new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(ts)) : "never";

const GRACE: { label: string; seconds: number }[] = [
  { label: "Replace at once", seconds: 0 },
  { label: "Old one works for 10 more minutes", seconds: 600 },
  { label: "Old one works for 1 more hour", seconds: 3600 },
];

interface Shown {
  device: KeyDevice;
  issued: IssuedKey;
}

export function KeysManager({ devices }: { devices: KeyDevice[] }) {
  const router = useRouter();
  const client = useMemo(
    () =>
      createKeysClient({
        baseUrl: GATEWAY_URL,
        getToken: async () => (await createClient().auth.getSession()).data.session?.access_token ?? null,
      }),
    []
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [confirmRelease, setConfirmRelease] = useState<string | null>(null);
  const [confirmChange, setConfirmChange] = useState<string | null>(null);
  const [waiting, setWaiting] = useState<string | null>(null);
  const [grace, setGrace] = useState(0);

  async function run(deviceId: string, work: () => Promise<void>) {
    setBusy(deviceId);
    try {
      await work();
      router.refresh();
    } catch (e) {
      notify.error(e instanceof KeysApiError ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  }

  const create = (d: KeyDevice) =>
    run(d.id, async () => {
      const issued = await client.create(d.id, d.isCharger ? "charger" : "gateway", d.name);
      setShown({ device: d, issued });
    });
  const rotate = (d: KeyDevice, keyId: string) =>
    run(d.id, async () => {
      const issued = await client.rotate(keyId, grace);
      setShown({ device: d, issued });
    });
  // Changes a unit's key without cutting it off: the unit gets the new key over its working connection and switches within seconds.
  const changeUnitKey = (d: KeyDevice) =>
    run(d.id, async () => {
      await client.startKeyChange(d.id);
      setConfirmChange(null);
      setWaiting(d.id);
      try {
        for (let i = 0; i < 20; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          if ((await client.keyChangeStatus(d.id)).state === "none") {
            notify.success("The key was changed. The unit is using its new key.");
            return;
          }
        }
        notify.info("The unit has not finished yet. It has 10 minutes; if it does not, nothing changes and it keeps its old key.");
      } finally {
        setWaiting(null);
      }
    });
  const release = (d: KeyDevice) =>
    run(d.id, async () => {
      const r = await client.releaseBoard(d.id);
      setConfirmRelease(null);
      if (r.released) notify.success("The unit was released. Set it up again from the setup page, for this device or another one.");
      else notify.error("No unit was linked to this device.");
    });
  const revoke = (d: KeyDevice, keyId: string) =>
    run(d.id, async () => {
      await client.revoke(keyId, "revoked from the admin page");
      setConfirmRevoke(null);
      notify.success(d.isCharger ? "The key was revoked. The charger can no longer connect with it." : "The unit was cut off. It can only come back by being set up again from the setup page.");
    });

  return (
    <div className="space-y-4">
      {shown ? <SecretBox shown={shown} onClose={() => setShown(null)} /> : null}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Device</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Last connected</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.map((d) => {
              const key = d.keys[0] ?? null;
              const pending = busy === d.id;
              return (
                <TableRow key={d.id}>
                  <TableCell>
                    <div className="flex items-center gap-2 font-medium">
                      {d.isCharger ? <PlugZap className="size-4 text-muted-foreground" /> : <Cpu className="size-4 text-muted-foreground" />}
                      {d.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {d.site}
                      {d.model ? ` · ${d.model}` : ""}
                    </div>
                  </TableCell>
                  <TableCell>
                    {key ? (
                      <div className="space-y-1">
                        {d.keyChange ? <Badge variant="secondary">Key change in progress</Badge> : <Badge variant="default">Active</Badge>}
                        <div className="font-mono text-xs text-muted-foreground" title="A short fingerprint of the secret; the secret itself is not kept anywhere readable.">
                          {key.fingerprint.slice(0, 12)}…
                        </div>
                        <div className="text-xs text-muted-foreground">made {when(key.createdAt)}</div>
                        {d.keys.length > 1 ? <div className="text-xs text-amber-600">{d.keys.length} keys are active (one is being replaced)</div> : null}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Badge variant="secondary">No key</Badge>
                        {!d.isCharger ? <div className="max-w-xs text-xs text-muted-foreground">A unit gets its key when it is set up. Open the setup page, pick this device and press Finish.</div> : null}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{key ? when(key.lastUsedAt) : "—"}</TableCell>
                  <TableCell className="text-right">
                    {!key ? (
                      d.isCharger ? (
                        <Button size="sm" disabled={pending} onClick={() => create(d)}>
                          <KeyRound className="size-3.5" /> {pending ? "Making…" : "Make a key"}
                        </Button>
                      ) : (
                        <a href="https://setup.waytaraenergy.com" target="_blank" rel="noreferrer" className="text-sm text-primary underline-offset-4 hover:underline">
                          Open the setup page
                        </a>
                      )
                    ) : waiting === d.id ? (
                      <span className="text-sm text-muted-foreground">Waiting for the unit to switch to its new key…</span>
                    ) : confirmChange === d.id ? (
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <span className="max-w-sm text-right text-xs text-muted-foreground">
                          Change this unit&apos;s key? The unit must be online. It receives the new key over its connection and switches within seconds; nothing is cut off. If it cannot finish in 10 minutes, nothing changes.
                        </span>
                        <Button size="sm" disabled={pending} onClick={() => changeUnitKey(d)}>
                          {pending ? "Starting…" : "Yes, change the key"}
                        </Button>
                        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirmChange(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : confirmRelease === d.id ? (
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <span className="max-w-xs text-right text-xs text-muted-foreground">Unlink the unit from this device? It stops sending data until a unit is set up for it again.</span>
                        <Button size="sm" variant="destructive" disabled={pending} onClick={() => release(d)}>
                          {pending ? "Releasing…" : "Yes, release"}
                        </Button>
                        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirmRelease(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : confirmRevoke === key.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="max-w-sm text-right text-xs text-muted-foreground">
                          {d.isCharger ? "Cut this charger off?" : "Cut this unit off? It stops sending data at once and can only come back by being set up again from the setup page. Use this for a lost or stolen unit."}
                        </span>
                        <Button size="sm" variant="destructive" disabled={pending} onClick={() => revoke(d, key.id)}>
                          {pending ? "Cutting off…" : d.isCharger ? "Yes, revoke" : "Yes, cut off"}
                        </Button>
                        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirmRevoke(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {d.isCharger ? (
                        <>
                        <select
                          aria-label={`How to replace the key of ${d.name}`}
                          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                          value={grace}
                          onChange={(e) => setGrace(Number(e.target.value))}
                        >
                          {GRACE.map((g) => (
                            <option key={g.seconds} value={g.seconds}>
                              {g.label}
                            </option>
                          ))}
                        </select>
                        <Button size="sm" variant="outline" disabled={pending} onClick={() => rotate(d, key.id)}>
                          {pending ? "Working…" : "Replace"}
                        </Button>
                        </>
                        ) : (
                          <Button size="sm" variant="outline" disabled={pending || d.keyChange !== null} onClick={() => setConfirmChange(d.id)} title="Change the unit's key while it is online; nothing is cut off">
                            Rotate key
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-destructive" disabled={pending} onClick={() => setConfirmRevoke(key.id)}>
                          {d.isCharger ? "Revoke" : "Cut off"}
                        </Button>
                        {!d.isCharger ? (
                          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirmRelease(d.id)} title="Unlink the monitoring unit so it can be set up for another device">
                            Release unit
                          </Button>
                        ) : null}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SecretBox({ shown, onClose }: { shown: Shown; onClose: () => void }) {
  const { device, issued } = shown;
  const [copied, setCopied] = useState<string | null>(null);
  const [name, setName] = useState(device.name);
  const address = device.isCharger ? chargerAddress(GATEWAY_HOST, issued.secret, name) : null;

  async function copy(what: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied((c) => (c === what ? null : c)), 2500);
    } catch {
      notify.error("Couldn't copy. Select the text and copy it by hand.");
    }
  }

  const row = "flex items-center gap-2 rounded-md border border-border bg-background p-2";
  return (
    <div role="alertdialog" aria-label="New secret" className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium">New {device.isCharger ? "charger address" : "key"} for {device.name}</p>
          <p className="text-sm text-muted-foreground">This is the only time it is shown. Copy it now; if it is lost, replace the key.</p>
        </div>
        <Button size="icon" variant="ghost" aria-label="Close" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>
      {address ? (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-muted-foreground" htmlFor="charger-name">
            Charger name in the address (letters, digits, dash)
          </label>
          <input id="charger-name" value={name} onChange={(e) => setName(e.target.value)} className="h-9 w-full max-w-xs rounded-md border border-border bg-background px-3 text-sm" />
          <div className={row}>
            <code className="min-w-0 flex-1 break-all text-xs">{address}</code>
            <Button size="sm" variant="outline" onClick={() => copy("address", address)}>
              {copied === "address" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied === "address" ? "Copied" : "Copy address"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Type this into the charger&apos;s app as the server address (OCPP 1.6-J). Anyone with it can connect as this charger.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className={row}>
            <code className="min-w-0 flex-1 break-all text-xs">{issued.secret}</code>
            <Button size="sm" variant="outline" onClick={() => copy("key", issued.secret)}>
              {copied === "key" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied === "key" ? "Copied" : "Copy key"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">This is the unit&apos;s sealing key. Keep it out of chat and email; it is not needed again if the unit is set up through the app.</p>
        </div>
      )}
      <div className="flex justify-end">
        <Button size="sm" onClick={onClose}>
          I&apos;ve copied it
        </Button>
      </div>
    </div>
  );
}
