import { createClient } from "@waytara/supabase/server";
import { PARTNER_STATUS_LABEL, PARTNER_STATUSES } from "@/lib/partners";

// The right side while no application is open (the list is in the layout): where every application stands, and how the team works one.
const STEPS = [
  { title: "Screen", text: "A new application waits under Needs you. Look at their answers, call them, then move it to Screening or Shortlisted." },
  { title: "Open onboarding", text: "Moving it to Onboarding opens their forms. They are e-mailed, and send their business details, licences and documents themselves." },
  { title: "Verify", text: "When they send it, it comes back under Needs you. Open each file, check it with the authority that issued it, and mark the checklist." },
  { title: "Decide", text: "Approve when the required checks are Verified, or decline and choose what happens to their data. Ask for more any time before." },
];

export default async function PartnersEmpty() {
  const supabase = await createClient();
  const { data } = await supabase.from("partner_applications").select("status");
  const count = (s: string) => (data ?? []).filter((r) => r.status === s).length;
  return (
    <div className="flex min-h-[18rem] flex-col gap-6 rounded-2xl border border-dashed border-border bg-card/40 p-8 max-lg:hidden">
      <div>
        <h2 className="text-lg font-semibold">Pick an application</h2>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">Choose one on the left to read it, verify it or decide. Here is where everything stands:</p>
      </div>
      <ul className="grid max-w-3xl grid-cols-3 gap-3 sm:grid-cols-6">
        {PARTNER_STATUSES.map((s) => (
          <li key={s} className="rounded-lg border border-border bg-card px-3 py-2.5">
            <p className="text-xl font-semibold tabular-nums">{count(s)}</p>
            <p className="text-xs text-muted-foreground">{PARTNER_STATUS_LABEL[s]}</p>
          </li>
        ))}
      </ul>
      <ol className="grid max-w-3xl gap-4 sm:grid-cols-2">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">{i + 1}</span>
            <div>
              <p className="text-sm font-medium">{s.title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
