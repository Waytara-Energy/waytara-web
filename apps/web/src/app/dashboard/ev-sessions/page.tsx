import Link from "next/link";
import { ArrowLeft, PlugZap } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { deviceDisplayId, getSelectedSite, resolveDeviceInSite } from "@/lib/selected-site";
import {
  curvePoints,
  formatSeconds,
  sessionEnergyKwh,
  sessionStatusLabel,
  sourceShares,
  stopReasonLabel,
  type EvSampleRow,
  type EvSessionRow,
} from "@/lib/ev-sessions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EvSessionCharts } from "@/components/dashboard/ev-session-charts";
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh";
import { FLOW } from "@/components/dashboard/flow-colors";

const SESSION_COLUMNS =
  "id, equipment_id, started_at, ended_at, status, source, is_test, stop_reason, start_energy_kwh, end_energy_kwh, meter_start_wh, meter_stop_wh, peak_power_kw, avg_power_kw, max_current_a, charging_seconds, energy_from_solar_kwh, energy_from_battery_kwh, energy_from_grid_kwh, energy_unattributed_kwh, solar_share_pct, site_data_coverage_pct, target_kwh";
const SAMPLE_COLUMNS = "ts, energy_kwh, power_kw, current_a_l1, voltage_v_l1, soc_pct, ev_from_solar_w, ev_from_battery_w, ev_from_grid_w";
/** How many sessions the list shows; the newest first. */
const LIST_LIMIT = 60;
/** One sample every 30 s: a day of charging is under 3000, so this is never reached in practice. */
const SAMPLE_LIMIT = 6000;

type SessionRow = EvSessionRow & { is_test: boolean };

const when = (ts: string) => new Date(ts).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const kwh = (v: number | null) => (v === null ? "—" : `${v.toFixed(v >= 10 ? 1 : 2)} kWh`);
const kw = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)} kW`);

function duration(s: SessionRow): string {
  if (s.charging_seconds !== null) return formatSeconds(s.charging_seconds);
  if (!s.ended_at) return "In progress";
  return formatSeconds((Date.parse(s.ended_at) - Date.parse(s.started_at)) / 1000);
}

function StatusBadge({ s }: { s: SessionRow }) {
  const { label, tone } = sessionStatusLabel(s.status);
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge variant={tone === "warn" ? "alert" : tone === "good" ? "default" : "secondary"}>{label}</Badge>
      {s.is_test || s.source === "simulated" ? <Badge variant="outline">Test</Badge> : null}
    </span>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

const SOURCE_COLOR = { solar: FLOW.producing, battery: FLOW.drawing, grid: FLOW.idle, unattributed: "var(--border)" } as const;

export default async function EvSessionsPage({ searchParams }: { searchParams: Promise<{ device?: string; session?: string }> }) {
  const [{ device: deviceParam, session: sessionParam }, site] = await Promise.all([searchParams, getSelectedSite()]);
  const chargers = (site?.devices ?? []).filter((d) => d.deviceType?.category === "ev_charger");
  const preferred = await resolveDeviceInSite(site, deviceParam);
  const charger = chargers.find((d) => d.id === preferred?.id) ?? chargers[0] ?? null;

  if (!site || !charger) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <PlugZap />
          </EmptyMedia>
          <EmptyTitle>No EV charger at this site</EmptyTitle>
          <EmptyDescription>Charging sessions appear here once a charger is installed and connected.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const supabase = await createClient();
  const realtime = (
    <>
      <RealtimeRefresh table="ev_sessions" event="INSERT" filter={`equipment_id=eq.${charger.id}`} debounceMs={2000} />
      <RealtimeRefresh table="ev_sessions" event="UPDATE" filter={`equipment_id=eq.${charger.id}`} debounceMs={2000} />
    </>
  );

  // ---- one session ----
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (sessionParam && uuid.test(sessionParam)) {
    const { data: row } = await supabase.from("ev_sessions").select(SESSION_COLUMNS).eq("id", sessionParam).eq("equipment_id", charger.id).maybeSingle();
    const session = row as SessionRow | null;
    if (session) {
      const [{ data: sampleRows }, { data: eventRows }] = await Promise.all([
        supabase.from("ev_session_samples").select(SAMPLE_COLUMNS).eq("session_id", session.id).order("ts", { ascending: true }).limit(SAMPLE_LIMIT),
        supabase.from("ev_events").select("id, ts, kind").eq("session_id", session.id).order("ts", { ascending: true }).limit(40),
      ]);
      const points = curvePoints((sampleRows ?? []) as EvSampleRow[]);
      const shares = sourceShares(session);
      const energy = sessionEnergyKwh(session);
      const reason = stopReasonLabel(session.stop_reason);
      return (
        <div className="space-y-4">
          {realtime}
          <Link href="/dashboard/ev-sessions" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> All sessions
          </Link>
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                {when(session.started_at)}
                <StatusBadge s={session} />
              </CardTitle>
              <CardDescription>
                {deviceDisplayId(charger)}
                {reason ? ` · ${reason}` : ""}
                {session.ended_at ? ` · ended ${when(session.ended_at)}` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <Figure label="Energy" value={kwh(energy)} />
                <Figure label="Charging time" value={duration(session)} />
                <Figure label="Peak power" value={kw(session.peak_power_kw)} />
                <Figure label="Average power" value={kw(session.avg_power_kw)} />
                <Figure label="Max current" value={session.max_current_a === null ? "—" : `${session.max_current_a.toFixed(0)} A`} />
                <Figure label="Solar share" value={session.solar_share_pct === null ? "—" : `${session.solar_share_pct.toFixed(0)}%`} />
              </div>
              {session.target_kwh !== null ? (
                <p className="text-sm text-muted-foreground">
                  You asked for {session.target_kwh} kWh; the charge stops by itself when that much has been delivered.
                </p>
              ) : null}
              {session.status === "suspect" ? (
                <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
                  The charger reported an energy figure that does not look right. We show it as reported; WayTara support can check it for you.
                </p>
              ) : null}
              {shares ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Where the energy came from</p>
                  <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label={shares.map((x) => `${x.label} ${x.pct.toFixed(0)}%`).join(", ")}>
                    {shares.filter((x) => x.pct > 0).map((x) => (
                      <div key={x.key} style={{ width: `${x.pct}%`, backgroundColor: SOURCE_COLOR[x.key] }} />
                    ))}
                  </div>
                  <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                    {shares.map((x) => (
                      <li key={x.key} className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full" style={{ backgroundColor: SOURCE_COLOR[x.key] }} aria-hidden />
                        {x.label} <span className="tabular-nums text-muted-foreground">{kwh(x.kwh)} · {x.pct.toFixed(0)}%</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground">
                    This is an estimate: at each reading the car is given the solar power first, then the battery, then the grid, using what the inverter reported at that moment
                    {session.site_data_coverage_pct !== null && session.site_data_coverage_pct < 100
                      ? `. The inverter's readings covered ${session.site_data_coverage_pct.toFixed(0)}% of this session; the rest is shown as not known.`
                      : "."}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {session.status === "active" ? "The solar, battery and grid split appears when the session ends." : "No solar, battery or grid split for this session — the inverter was not reporting while it charged."}
                </p>
              )}
            </CardContent>
          </Card>
          <EvSessionCharts points={points} />
          {(eventRows ?? []).length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">What the charger reported</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {(eventRows ?? []).map((e) => (
                    <li key={e.id} className="flex gap-3">
                      <span className="w-28 shrink-0 tabular-nums text-muted-foreground">{when(e.ts)}</span>
                      <span>{e.kind.replace(/_/g, " ")}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      );
    }
  }

  // ---- the list ----
  const { data: rows } = await supabase.from("ev_sessions").select(SESSION_COLUMNS).eq("equipment_id", charger.id).order("started_at", { ascending: false }).limit(LIST_LIMIT);
  const sessions = (rows ?? []) as SessionRow[];
  const done = sessions.filter((s) => s.status !== "active");
  const totalEnergy = done.reduce((sum, s) => sum + (sessionEnergyKwh(s) ?? 0), 0);
  const solarKwh = done.reduce((sum, s) => sum + (s.energy_from_solar_kwh ?? 0), 0);
  const attributedKwh = done.reduce((sum, s) => sum + (s.energy_from_solar_kwh ?? 0) + (s.energy_from_battery_kwh ?? 0) + (s.energy_from_grid_kwh ?? 0), 0);

  return (
    <div className="space-y-4">
      {realtime}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Charging sessions</CardTitle>
          <CardDescription>
            {deviceDisplayId(charger)}
            {chargers.length > 1 ? ` · ${chargers.length} chargers at this site` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Figure label="Sessions shown" value={String(sessions.length)} />
            <Figure label="Energy delivered" value={kwh(sessions.length ? totalEnergy : null)} />
            <Figure label="From solar" value={attributedKwh > 0 ? `${((solarKwh / attributedKwh) * 100).toFixed(0)}%` : "—"} />
            <Figure label="Longest session" value={formatSeconds(done.reduce<number | null>((m, s) => (s.charging_seconds !== null && (m === null || s.charging_seconds > m) ? s.charging_seconds : m), null))} />
          </div>
        </CardContent>
      </Card>
      {sessions.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PlugZap />
            </EmptyMedia>
            <EmptyTitle>No charging sessions yet</EmptyTitle>
            <EmptyDescription>Plug in a car and start charging — the session shows up here within a minute.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>Charging time</TableHead>
                  <TableHead className="text-right">Energy</TableHead>
                  <TableHead className="text-right">Solar share</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link href={`/dashboard/ev-sessions?session=${s.id}&device=${charger.id}`} className="font-medium underline-offset-4 hover:underline">
                        {when(s.started_at)}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular-nums">{duration(s)}</TableCell>
                    <TableCell className="text-right tabular-nums">{kwh(sessionEnergyKwh(s))}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.solar_share_pct === null ? "—" : `${s.solar_share_pct.toFixed(0)}%`}</TableCell>
                    <TableCell>
                      <StatusBadge s={s} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
