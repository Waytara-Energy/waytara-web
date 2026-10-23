import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { Pill, SettingsCard } from "./settings-card";

export interface PlanSummary {
  name: string | null;
  price: number | null;
  /** "active", "trialing" ... or null with no subscription record */
  status: string | null;
  /** how far into the current period, and the days left, worked out by the server */
  progress: { percent: number; daysLeft: number } | null;
  periodEnd: string | null;
  /** when the plan began, and the state of the account (shown on the Billing tab) */
  since?: string | null;
  accountStatus?: string | null;
}

const SUBSCRIPTION: Record<string, string> = { trialing: "Trial", active: "Active", past_due: "Payment due", cancelled: "Cancelled" };
const dateText = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** The plan, its price, the subscription state and how far into its period it is. `action` is an optional button under it (the Account tab
 *  uses it to open the Billing tab). */
export function PlanCard({ plan, action }: { plan: PlanSummary; action?: ReactNode }) {
  return (
    <SettingsCard
      title="Your plan"
      description="What you bought, and your ongoing monitoring and dashboard access."
      icon={Sparkles}
      tone="violet"
      badge={plan.status ? <Pill tone={plan.status === "active" || plan.status === "trialing" ? "emerald" : "amber"}>{SUBSCRIPTION[plan.status] ?? plan.status}</Pill> : undefined}
    >
      <div>
        <p className="text-2xl font-semibold tracking-tight text-foreground">{plan.name ?? "No plan yet"}</p>
        {plan.price !== null && <p className="text-sm text-muted-foreground">₹{plan.price.toLocaleString("en-IN")} one-time</p>}
      </div>
      {plan.since || plan.accountStatus ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          {plan.since ? (
            <>
              <dt className="text-muted-foreground">Active since</dt>
              <dd className="text-right font-medium">{dateText(plan.since)}</dd>
            </>
          ) : null}
          {plan.accountStatus ? (
            <>
              <dt className="text-muted-foreground">Account</dt>
              <dd className="text-right font-medium capitalize">{plan.accountStatus}</dd>
            </>
          ) : null}
        </dl>
      ) : null}
      {plan.progress ? (
        <div className="space-y-1.5">
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={plan.progress.percent} aria-valuemin={0} aria-valuemax={100} aria-label="How much of the current period has passed">
            <div className="h-full rounded-full bg-violet-500" style={{ width: `${plan.progress.percent}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            {plan.progress.daysLeft} {plan.progress.daysLeft === 1 ? "day" : "days"} left in this subscription period
            {plan.periodEnd ? ` (until ${dateText(plan.periodEnd)})` : ""}
          </p>
        </div>
      ) : plan.status ? null : (
        <p className="text-xs text-muted-foreground">No subscription record yet.</p>
      )}
      {action}
    </SettingsCard>
  );
}
