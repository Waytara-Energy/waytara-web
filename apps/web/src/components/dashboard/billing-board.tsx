"use client";

import Link from "next/link";
import { CircleCheck, CreditCard, LifeBuoy, Receipt, WalletCards, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SUBSCRIPTION_LABEL, paymentTypeLabel, type PaymentRow, type PaymentSummary } from "@/lib/billing-summary";
import { inr } from "@/lib/savings";
import { cn } from "@/lib/utils";
import { useHashTab } from "./use-hash-tab";

type SectionId = "plan" | "payments";
const SECTIONS: { id: SectionId; label: string; icon: LucideIcon; active: string; circle: string }[] = [
  { id: "plan", label: "Plan", icon: CreditCard, active: "data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400", circle: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  { id: "payments", label: "Payments", icon: WalletCards, active: "data-[state=active]:border-sky-500 data-[state=active]:text-sky-600 dark:data-[state=active]:text-sky-400", circle: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
];
const IDS = SECTIONS.map((s) => s.id);

const PAYMENT_BADGE: Record<string, "default" | "alert" | "secondary"> = { paid: "default", pending: "alert", failed: "alert", refunded: "secondary" };
const dateText = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

export interface BillingPlan {
  name: string;
  price: number;
  since: string | null;
  accountStatus: string;
}

export interface BillingSubscription {
  status: string;
  start: string | null;
  end: string | null;
  /** how far into the period it is, worked out by the server (null without both dates) */
  progress: { percent: number; daysLeft: number } | null;
}

const BILLING_HELP = `/dashboard/support?${new URLSearchParams({ new: "1", category: "billing", subject: "Question about my billing" })}`;

/** The Billing & Plan page, in the same shape as Performance and Maintenance: a headline for the open tab, then two tabs. Plan shows what
 *  the customer bought and their subscription; Payments lists every payment with its status. Billing questions go to Support. */
export function BillingBoard({ plan, subscription, payments, summary }: { plan: BillingPlan | null; subscription: BillingSubscription | null; payments: PaymentRow[]; summary: PaymentSummary }) {
  const [section, open] = useHashTab(IDS, "plan");
  const meta = SECTIONS.find((s) => s.id === section)!;
  const Icon = meta.icon;

  const head =
    section === "plan"
      ? {
          label: "Current plan",
          value: plan?.name ?? "No plan yet",
          figures: [
            { label: "Active since", value: dateText(plan?.since ?? null) },
            { label: "Subscription", value: subscription ? (SUBSCRIPTION_LABEL[subscription.status] ?? subscription.status) : "—" },
          ],
        }
      : {
          label: "Total paid",
          value: inr(summary.paid),
          figures: [
            { label: "Payments", value: String(summary.count) },
            { label: "Pending", value: summary.pending > 0 ? inr(summary.pending) : "—" },
          ],
        };

  return (
    <div className="space-y-5">
      <div className="flex min-w-0 items-center gap-4">
        <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-full", meta.circle)}>
          <Icon className="size-7" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-theme-muted">{head.label}</p>
          <p className="truncate text-4xl font-semibold leading-tight tracking-tight text-theme-primary">{head.value}</p>
        </div>
        <div className="hidden items-center gap-8 pl-6 md:flex">
          {head.figures.map((f) => (
            <div key={f.label}>
              <p className="text-sm font-medium text-theme-muted">{f.label}</p>
              <p className="text-2xl font-semibold tracking-tight text-theme-primary">{f.value}</p>
            </div>
          ))}
        </div>
      </div>

      <Tabs value={section} onValueChange={(v) => open(v as SectionId)}>
        <TabsList variant="line">
          {SECTIONS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} variant="line" className={t.active}>
              <t.icon className="size-4 shrink-0 group-data-[state=active]:hidden" />
              <span className="text-sm font-medium">{t.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div key={section} className="space-y-4">
        {section === "plan" ? <PlanTab plan={plan} subscription={subscription} /> : <PaymentsTab payments={payments} summary={summary} />}
      </div>
    </div>
  );
}

function PlanTab({ plan, subscription }: { plan: BillingPlan | null; subscription: BillingSubscription | null }) {
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Your plan</CardTitle>
          </CardHeader>
          <CardContent>
            {plan ? (
              <div className="space-y-4">
                <div>
                  <p className="text-2xl font-semibold tracking-tight text-foreground">{plan.name}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{inr(plan.price)} one-time</p>
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Active since</dt>
                  <dd className="text-right font-medium">{dateText(plan.since)}</dd>
                  <dt className="text-muted-foreground">Account</dt>
                  <dd className="text-right font-medium capitalize">{plan.accountStatus}</dd>
                </dl>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No plan assigned yet. Your WayTara advisor sets this up during installation.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Subscription</CardTitle>
            <CardDescription>Ongoing monitoring &amp; dashboard access</CardDescription>
          </CardHeader>
          <CardContent>
            {subscription ? (
              <div className="space-y-4">
                <Badge variant={subscription.status === "active" || subscription.status === "trialing" ? "default" : "alert"}>
                  {subscription.status === "active" && <CircleCheck className="mr-1 size-3" />}
                  {SUBSCRIPTION_LABEL[subscription.status] ?? subscription.status}
                </Badge>
                {subscription.progress ? (
                  <div className="space-y-2">
                    <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={subscription.progress.percent} aria-valuemin={0} aria-valuemax={100} aria-label="How much of the current period has passed">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${subscription.progress.percent}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{dateText(subscription.start)}</span>
                      <span className="font-medium text-foreground">{subscription.progress.daysLeft} {subscription.progress.daysLeft === 1 ? "day" : "days"} left</span>
                      <span>{dateText(subscription.end)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No period dates yet.</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No subscription record yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <HelpCard />
    </>
  );
}

function HelpCard() {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <LifeBuoy className="size-5" />
          </span>
          <div>
            <p className="font-medium text-foreground">A question about a payment or your plan?</p>
            <p className="text-sm text-muted-foreground">Ask in Support. The team replies there and by e-mail.</p>
          </div>
        </div>
        <Button asChild size="sm">
          <Link href={BILLING_HELP}>Ask about billing</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function PaymentsTab({ payments, summary }: { payments: PaymentRow[]; summary: PaymentSummary }) {
  if (payments.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Receipt />
              </EmptyMedia>
              <EmptyTitle>No payments yet</EmptyTitle>
              <EmptyDescription>Payments you make will show up here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    );
  }
  return (
    <>
      {summary.pending > 0 && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          {inr(summary.pending)} is waiting to be paid. If you have already paid it, it can take a little while to show here.
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Payment history</CardTitle>
          {summary.lastPaidAt && <CardDescription>Last payment on {dateText(summary.lastPaidAt)}</CardDescription>}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="hidden sm:table-cell">Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-foreground">{paymentTypeLabel(p.payment_type)}</TableCell>
                    <TableCell className="text-muted-foreground">{dateText(p.paid_at ?? p.created_at)}</TableCell>
                    <TableCell className="hidden capitalize text-muted-foreground sm:table-cell">{p.method ? p.method.replace(/_/g, " ") : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums text-foreground">{inr(Number(p.amount))}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={PAYMENT_BADGE[p.status] ?? "secondary"} className="capitalize">
                        {p.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <HelpCard />
    </>
  );
}
