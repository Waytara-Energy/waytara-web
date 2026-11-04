"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CAPABILITY_KEYS, CAPABILITY_KEY_NAMES, capabilityValue } from "@/lib/ev-settings";
import { hubJson } from "./ev-settings-hub";

type Row = { key: string; value: string | null; readonly: boolean };

/** What the charger supports for charging limits (smart charging): asked from the charger itself when the button is pressed, through the service.
 *  The charger must be connected; the answer is shown as it came. */
export function EvCapabilities({ chargerId }: { chargerId: string }) {
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [unknown, setUnknown] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [askedAt, setAskedAt] = React.useState<string | null>(null);

  async function request() {
    setLoading(true);
    setError(null);
    const r = await hubJson<{ configuration: Row[]; unknown?: string[] }>("GET", `/v1/ev/${encodeURIComponent(chargerId)}/configuration?keys=${CAPABILITY_KEY_NAMES.join(",")}`);
    setLoading(false);
    if (!r.ok) {
      setError(r.status === 404 ? "Asking the charger is not available on the service yet." : r.message);
      return;
    }
    setRows(r.data.configuration);
    setUnknown(r.data.unknown ?? []);
    setAskedAt(new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit" }));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => void request()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : null}
          {rows ? "Request again" : "Request from the charger"}
        </Button>
        <span className="text-xs text-muted-foreground">{askedAt ? `Answered at ${askedAt}` : "The charger must be connected."}</span>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {rows ? (
        <dl className="divide-y divide-theme-border">
          {CAPABILITY_KEYS.map((meta) => {
            const v = capabilityValue(meta.key, rows, unknown);
            return (
              <div key={meta.key} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 text-sm first:pt-0 last:pb-0">
                <dt className="min-w-0">
                  <span className="font-medium text-foreground">{meta.label}</span>
                  <span className="block text-xs text-muted-foreground">{meta.help}</span>
                  <span className="block font-mono text-[11px] text-muted-foreground/80">{meta.key}</span>
                </dt>
                <dd className="flex flex-wrap justify-end gap-1.5 text-right font-medium tabular-nums">
                  {v.missing ? <span className="text-muted-foreground">Not on this charger</span> : v.items.map((i) => (meta.key === "SupportedFeatureProfiles" ? <Badge key={i} variant="secondary">{i}</Badge> : <span key={i}>{i}</span>))}
                </dd>
              </div>
            );
          })}
        </dl>
      ) : null}
    </div>
  );
}
