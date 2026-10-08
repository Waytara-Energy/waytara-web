import { createClient } from "@waytara/supabase/server";
import { Button } from "@waytara/ui/button";
import { Input } from "@waytara/ui/input";
import { ActionForm } from "@waytara/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { INDIAN_STATES, TARIFF_CATEGORIES } from "@/lib/india-states";
import { saveTariff, deleteScheduledTariff } from "./actions";

// Admin-only (see proxy.ts). The electricity rate of every state, per kind of property: what the customer's Cost & Savings
// page values a unit at, by the state in the site's address. A rate has the date it takes effect; a daily job turns each rate
// whose date has arrived into a recorded change and e-mails the customers it affects. Enter a regulator's order as soon as it is
// published, with its effective date, and customers hear on that day.

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
  const { data } = await supabase
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
  const field = "h-9 w-full rounded-md border border-border bg-background px-2 text-sm";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Electricity rates</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          The tariff a customer&apos;s bill is worked out with - by the state in the site&apos;s address and its kind of property (homes are
          residential, offices and hotels commercial, factories industrial): slab bands, free units, duty. The figure beside each state is the
          typical ₹ per unit (the average cost of a unit at 250 units a month); the savings themselves use the bands. Where no tariff is set
          for a state, that customer&apos;s own account rate is used. Add a tariff with the date it takes effect; a daily job (06:00) records
          each change as its date arrives and e-mails the customers it affects. <strong>Indicative</strong> tariffs are read from published
          tables and not yet checked; replace them with the regulator&apos;s order and mark them <strong>verified</strong>.
        </p>
      </div>

      <ActionForm action={saveTariff} loading="Saving rate…" success="Rate saved." className="space-y-4 rounded-lg border p-4">
        <h2 className="text-base font-semibold">Add a rate</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span className="font-medium">State</span>
            <select name="state" required defaultValue="" className={field}>
              <option value="" disabled>
                Select…
              </option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Kind of property</span>
            <select name="category" required defaultValue="residential" className={field}>
              {TARIFF_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Single rate (₹ per kWh)</span>
            <Input name="rate" type="number" step="0.01" min="0" max="100" placeholder="only if there are no slabs" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Export rate (optional)</span>
            <Input name="exportRate" type="number" step="0.01" min="0" max="100" placeholder="blank = netted against imports" />
          </label>
          <label className="space-y-1 text-sm sm:col-span-2 lg:col-span-4">
            <span className="font-medium">Slabs (one per line: top of the band in units per bill, then ₹ per unit)</span>
            <textarea name="slabs" rows={5} placeholder={"100 3.50\n300 6.00\n400 7.50\n9.75   ← last line: just the rate, for everything above"} className="w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-sm" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Bill covers</span>
            <select name="billingMonths" defaultValue="1" className={field}>
              <option value="1">1 month</option>
              <option value="2">2 months (e.g. Tamil Nadu)</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Electricity duty (%)</span>
            <Input name="dutyPct" type="number" step="0.1" min="0" max="50" defaultValue="0" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Fuel / wheeling (₹ per unit)</span>
            <Input name="surcharge" type="number" step="0.01" min="0" max="20" defaultValue="0" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Free units per bill</span>
            <Input name="freeUnits" type="number" step="1" min="0" max="1000" defaultValue="0" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Free units stop above (units)</span>
            <Input name="freeUnitsCap" type="number" step="1" min="0" placeholder="blank = never" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Free units left above that</span>
            <Input name="freeUnitsOverCap" type="number" step="1" min="0" defaultValue="0" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Takes effect on</span>
            <Input name="effectiveFrom" type="date" defaultValue={today} required />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Status</span>
            <select name="confidence" defaultValue="verified" className={field}>
              <option value="verified">Verified (from the regulator&apos;s order)</option>
              <option value="indicative">Indicative (an estimate)</option>
            </select>
          </label>
          <label className="space-y-1 text-sm lg:col-span-2">
            <span className="font-medium">Link to the order</span>
            <Input name="sourceUrl" type="url" placeholder="https://…" />
          </label>
          <label className="space-y-1 text-sm lg:col-span-4">
            <span className="font-medium">Note (optional)</span>
            <Input name="sourceNote" placeholder="e.g. TNERC order no. 6 of 2025, LT commercial" />
          </label>
        </div>
        <Button type="submit">Save rate</Button>
      </ActionForm>

      {scheduled.length > 0 && (
        <div className="space-y-2 rounded-lg border p-4">
          <h2 className="text-base font-semibold">Scheduled changes</h2>
          <ul className="space-y-2 text-sm">
            {scheduled.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <span className="font-medium">{r.state}</span> · {r.category} · ₹{Number(r.rate_per_kwh).toFixed(2)} from {fmtDate(r.effective_from)}
                </span>
                <ActionForm action={deleteScheduledTariff.bind(null, r.id)} loading="Removing…" success="Removed.">
                  <button type="submit" className="text-xs text-muted-foreground hover:text-destructive hover:underline">
                    Remove
                  </button>
                </ActionForm>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-base font-semibold">Rates in force</h2>
        <p className="text-xs text-muted-foreground">{missing} of {INDIAN_STATES.length} states have no residential rate yet.</p>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">State</th>
                {TARIFF_CATEGORIES.map((c) => (
                  <th key={c} className="px-3 py-2 font-medium capitalize">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {INDIAN_STATES.map((s) => (
                <tr key={s} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{s}</td>
                  {TARIFF_CATEGORIES.map((c) => {
                    const r = current.get(`${s}|${c}`);
                    return (
                      <td key={c} className="px-3 py-2">
                        {r ? (
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="tabular-nums">₹{Number(r.rate_per_kwh).toFixed(2)}</span>
                            <span className="text-xs text-muted-foreground">
                              {r.slabs && r.slabs.length > 1 ? `${r.slabs.length} slabs` : "flat"}
                              {Number(r.free_units) > 0 ? ` · ${Number(r.free_units)} free` : ""}
                            </span>
                            <Badge variant={r.confidence === "verified" ? "default" : "secondary"}>{r.confidence === "verified" ? "verified" : "estimate"}</Badge>
                            <span className="text-xs text-muted-foreground">since {fmtDate(r.effective_from)}</span>
                            {r.source_url && (
                              <a href={r.source_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                                source
                              </a>
                            )}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">not set</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
