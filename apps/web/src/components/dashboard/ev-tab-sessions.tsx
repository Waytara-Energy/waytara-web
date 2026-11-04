"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { sessionStatusLabel } from "@/lib/ev-sessions";
import { sessionFigures, type TabSession } from "@/lib/ev-tab";
import { getEvSessionDetail } from "@/app/dashboard/ev-session-detail-action";
import { EvSessionDialog } from "./ev-session-dialog";

const when = (ts: string) => new Date(ts).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const kwh = (v: number | null) => (v === null ? "—" : `${v.toFixed(v >= 10 ? 1 : 2)} kWh`);

/** Today's charging sessions of one charger: when, how long, energy, peak power and the solar share, newest first. A press on a row opens that one
 *  charge in full; the link leads to the longer history in Reports. */
export function EvTabSessions({ sessions, deviceId }: { sessions: TabSession[]; deviceId: string }) {
  const [openId, setOpenId] = React.useState<string | null>(null);
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-sm">Charging sessions today</CardTitle>
          <CardDescription>
            {sessions.length === 0 ? "No charge has started today." : `${sessions.length} ${sessions.length === 1 ? "session" : "sessions"}`}
          </CardDescription>
        </div>
        <Link href={`/dashboard/reports?device=${deviceId}#ev`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          All sessions <ArrowRight className="size-3.5" />
        </Link>
      </CardHeader>
      {sessions.length > 0 ? (
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Started</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="text-right">Energy</TableHead>
                <TableHead className="text-right">Peak</TableHead>
                <TableHead className="text-right">Solar</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((s) => {
                const f = sessionFigures(s);
                const st = sessionStatusLabel(s.status);
                return (
                  <TableRow key={s.id}>
                    <TableCell className="tabular-nums">
                      <button type="button" onClick={() => setOpenId(s.id)} className="font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                        {when(s.started_at)}
                      </button>
                    </TableCell>
                    <TableCell className="tabular-nums">{s.ended_at ? f.duration : `${f.duration} so far`}</TableCell>
                    {/* a running charge's energy is the "This charge" tile above: not shown twice */}
                    <TableCell className="text-right tabular-nums">{s.ended_at ? kwh(f.energyKwh) : <span className="text-muted-foreground">in progress</span>}</TableCell>
                    <TableCell className="text-right tabular-nums">{f.peakKw === null ? "—" : `${f.peakKw.toFixed(1)} kW`}</TableCell>
                    <TableCell className="text-right tabular-nums">{f.solarPct === null ? "—" : `${Math.round(f.solarPct)}%`}</TableCell>
                    <TableCell>
                      <Badge variant={st.tone === "warn" ? "alert" : st.tone === "good" ? "default" : "secondary"}>{st.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      ) : null}
      <EvSessionDialog sessionId={openId} onClose={() => setOpenId(null)} load={getEvSessionDetail} />
    </Card>
  );
}
