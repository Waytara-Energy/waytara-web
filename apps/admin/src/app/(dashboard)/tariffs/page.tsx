import { CalendarClock, CheckCircle2, MapPin, Zap } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { ActionForm } from "@waytara/ui/action-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadError, PageHeader, StatCard, StatGrid, ToneBadge } from "@/components/page-kit";
import { INDIAN_STATES, TARIFF_CATEGORIES } from "@/lib/india-states";
import { saveTariff, deleteScheduledTariff } from "./actions";
import { RateDialog } from "./rate-dialog";

// Admin-only (see proxy.ts). The electricity rate of every state, per kind of property: what the customer's Cost & Savings page values a unit at,
// by the state in the site's address. A rate has the date it takes effect; a daily job turns each rate whose date has arrived into a recorded
// change and e-mails the customers it affects. Enter a regulator's order as soon as it is published, with its effective date.

type Row = {
  id: string;
  state: string;
  category: string;
  rate_per_kwh: number;
  export_rate_per_kwh: number | null;
  effective_from: string;
  source_url: string | null;
  confidence: string;
  slabs: { upTo: number | null; rate: number }[] | null;
  free_units: number;
};

const fmtDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export default async function TariffsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("electricity_tariffs")
    .select("id, state, category, rate_per_kwh, export_rate_per_kwh, effective_from, source_url, confidence, slabs, free_units")
    .order("effective_from", { ascending: false });
  const rows = (data ?? []) as Row[];
  const today = new Date(new Date().getTime() + 19_800_000).toISOString().slice(0, 10);

  const current = new Map<string, Row>();
  for (const r of rows) {
    if (r.effective_from <= today && !current.has(`${r.state}|${r.category}`)) current.set(`${r.state}|${r.category}`, r);
  }
  const scheduled = rows.filter((r) => r.effective_from > today).sort((a, b) => a.effective_from.localeCompare(b.effective_from));
  const missing = INDIAN_STATES.filter((s) => !current.has(`${s}|residential`)).length;
  const inForce = [...current.values()];
  const verified = inForce.filter((r) => r.confidence === "verified").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Electricity rates"
        description="The tariff a customer's bill is worked out with, by the state in the site's address and its kind of property: slab bands, free units, duty. Where no tariff is set for a state, the customer's own account rate is used. Indicative rates are read from published tables and not yet checked; replace them with the regulator's order and mark them verified."
        actions={<RateDialog action={saveTariff} today={today} />}
      />

      <StatGrid>
        <StatCard icon={Zap} title="Rates in force" value={inForce.length} detail="States and property kinds with a rate" />
        <StatCard icon={CheckCircle2} title="Verified" value={verified} detail={`${inForce.length - verified} are estimates`} tone={inForce.length - verified > 0 ? "warn" : "good"} />
        <StatCard icon={CalendarClock} title="Scheduled" value={scheduled.length} detail="Take effect on a later date" />
        <StatCard icon={MapPin} title="States without a home rate" value={missing} detail={`Of ${INDIAN_STATES.length} states and territories`} tone={missing > 0 ? "warn" : "good"} />
      </StatGrid>

      {scheduled.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scheduled changes</CardTitle>
            <CardDescription>These take effect on their date; customers are e-mailed then.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-lg border">
              {scheduled.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <span>
                    <span className="font-medium">{r.state}</span> <span className="capitalize text-muted-foreground">· {r.category}</span> · ₹{Number(r.rate_per_kwh).toFixed(2)} from {fmtDate(r.effective_from)}
                  </span>
                  <ActionForm action={deleteScheduledTariff.bind(null, r.id)} loading="Removing…" success="Removed.">
                    <Button type="submit" variant="ghost" size="sm">
                      Remove
                    </Button>
                  </ActionForm>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <LoadError message={`Couldn't load the rates: ${error.message}`} />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>State</TableHead>
                {TARIFF_CATEGORIES.map((c) => (
                  <TableHead key={c} className="capitalize">
                    {c}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {INDIAN_STATES.map((s) => (
                <TableRow key={s}>
                  <TableCell className="font-medium">{s}</TableCell>
                  {TARIFF_CATEGORIES.map((c) => {
                    const r = current.get(`${s}|${c}`);
                    return (
                      <TableCell key={c}>
                        {r ? (
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-medium tabular-nums">₹{Number(r.rate_per_kwh).toFixed(2)}</span>
                            <ToneBadge tone={r.confidence === "verified" ? "good" : "warn"}>{r.confidence === "verified" ? "Verified" : "Estimate"}</ToneBadge>
                            <span className="text-xs text-muted-foreground">
                              {r.slabs && r.slabs.length > 1 ? `${r.slabs.length} slabs` : "flat"}
                              {Number(r.free_units) > 0 ? ` · ${Number(r.free_units)} free` : ""} · since {fmtDate(r.effective_from)}
                            </span>
                            {r.source_url ? (
                              <a href={r.source_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                                source
                              </a>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not set</span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
