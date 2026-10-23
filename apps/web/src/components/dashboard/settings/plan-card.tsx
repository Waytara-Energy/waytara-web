import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill, SettingsCard } from "./settings-card";

export interface PlanSummary {
  name: string | null;
  price: number | null;
  /** "active", "trialing" ... or null with no subscription record */
  status: string | null;
  /** how far into the current period, and the days left, worked out by the server */
  progress: { percent: number; daysLeft: number } | null;
  periodEnd: string | null;
}

const SUBSCRIPTION: Record<string, string> = { trialing: "Trial", active: "Active", past_due: "Payment due", cancelled: "Cancelled" };

/** The plan, its price, the subscription state and how far into its period it is, with a way to the Billing & plan page. */
export function PlanCard({ plan }: { plan: PlanSummary }) {
  return (
    <SettingsCard title="Your plan" icon={Sparkles} tone="violet" badge={plan.status ? <Pill tone={plan.status === "active" || plan.status === "trialing" ? "emerald" : "amber"}>{SUBSCRIPTION[plan.status] ?? plan.status}</Pill> : undefined}>
      <div>
        <p className="text-2xl font-semibold tracking-tight text-foreground">{plan.name ?? "No plan yet"}</p>
        {plan.price !== null && <p className="text-sm text-muted-foreground">₹{plan.price.toLocaleString("en-IN")} one-time</p>}
      </div>
      {plan.progress ? (
        <div className="space-y-1.5">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-violet-500" style={{ width: `${plan.progress.percent}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            {plan.progress.daysLeft} {plan.progress.daysLeft === 1 ? "day" : "days"} left in this subscription period
            {plan.periodEnd ? ` (until ${new Date(plan.periodEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })})` : ""}
          </p>
        </div>
      ) : null}
      <Button asChild variant="outline" size="sm" className="w-full">
        <Link href="/dashboard/billing">
          Open Billing &amp; plan
          <ArrowRight className="size-3.5" />
        </Link>
      </Button>
    </SettingsCard>
  );
}
