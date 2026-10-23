import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { sessionStatusLabel } from "@/lib/ev-sessions";
import { energyOfSessions, sessionFigures, type TabSession } from "@/lib/ev-tab";

const when = (ts: string) => new Date(ts).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const kwh = (v: number | null) => (v === null ? "—" : `${v.toFixed(v >= 10 ? 1 : 2)} kWh`);

/** Today's charging sessions of one charger: when, how long, energy, peak power and the solar share, newest first, with a link to the whole history. */
export function EvTabSessions({ sessions }: { sessions: TabSession[] }) {
  const total = energyOfSessions(sessions);
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-sm">Charging sessions today</CardTitle>
          <CardDescription>
            {sessions.length === 0 ? "No charge has started today." : `${sessions.length} ${sessions.length === 1 ? "session" : "sessions"} · ${kwh(total)}`}
          </CardDescription>
        </div>
        <Link href="/dashboard/ev-sessions" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
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
                    <TableCell className="tabular-nums">{when(s.started_at)}</TableCell>
                    <TableCell className="tabular-nums">{s.ended_at ? f.duration : `${f.duration} so far`}</TableCell>
                    <TableCell className="text-right tabular-nums">{kwh(f.energyKwh)}</TableCell>
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
    </Card>
  );
}
