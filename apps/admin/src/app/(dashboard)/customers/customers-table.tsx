"use client";

import * as React from "react";
import Link from "next/link";
import { Search, UserCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ToneBadge, type Tone } from "@/components/page-kit";
import { SubscriptionControls, type PlanOption } from "./subscription-controls";

export interface CustomerRow {
  id: string;
  name: string | null;
  email: string | null;
  plan: string | null;
  status: string;
  created_at: string;
  onboardingId: string | null;
  subscription: { id: string; status: string; planId: string; periodEnd: string | null } | null;
}

const STATUS_TONE: Record<string, Tone> = { active: "good", trialing: "info", past_due: "bad", cancelled: "neutral", inactive: "neutral", suspended: "bad" };
const SUBSCRIPTION_LABEL: Record<string, string> = { trialing: "Trial", active: "Active", past_due: "Payment due", cancelled: "Cancelled" };
const SUBSCRIPTION_TONE: Record<string, Tone> = { trialing: "info", active: "good", past_due: "bad", cancelled: "neutral" };

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null);

/** Every account with a customer profile: search, filter by subscription, and manage a subscription from its row. */
export function CustomersTable({ rows, plans, today }: { rows: CustomerRow[]; plans: PlanOption[]; today: string }) {
  const [search, setSearch] = React.useState("");
  const [sub, setSub] = React.useState("all");

  const q = search.trim().toLowerCase();
  const shown = rows.filter((r) => {
    if (sub === "none" ? r.subscription : sub !== "all" && r.subscription?.status !== sub) return false;
    return !q || [r.name, r.email, r.plan].some((f) => f?.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search name, email, plan…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-72 pl-8" />
        </div>
        <Select value={sub} onValueChange={setSub}>
          <SelectTrigger className="w-48" aria-label="Subscription">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any subscription</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trialing">Trial</SelectItem>
            <SelectItem value="past_due">Payment due</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="none">No subscription</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">
          {shown.length} of {rows.length}
        </span>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        {shown.length === 0 ? (
          <EmptyState icon={UserCircle2} title={rows.length === 0 ? "No customer accounts yet" : "No customers match"} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Manage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-medium">{c.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{c.email}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.plan ?? "None"}</TableCell>
                  <TableCell>
                    <ToneBadge tone={STATUS_TONE[c.status] ?? "neutral"} className="capitalize">
                      {c.status.replace("_", " ")}
                    </ToneBadge>
                  </TableCell>
                  <TableCell>
                    {c.subscription ? (
                      <div className="grid gap-1">
                        <ToneBadge tone={SUBSCRIPTION_TONE[c.subscription.status] ?? "neutral"} className="w-fit">
                          {SUBSCRIPTION_LABEL[c.subscription.status] ?? c.subscription.status}
                        </ToneBadge>
                        {day(c.subscription.periodEnd) ? <span className="text-xs text-muted-foreground">until {day(c.subscription.periodEnd)}</span> : null}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">None</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{new Date(c.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</TableCell>
                  <TableCell>
                    <div className="flex flex-col items-end gap-1.5">
                      <SubscriptionControls
                        customerId={c.id}
                        customerName={c.name ?? c.email ?? "this customer"}
                        plans={plans}
                        today={today}
                        current={c.subscription ? { id: c.subscription.id, status: c.subscription.status, planId: c.subscription.planId } : null}
                      />
                      {c.onboardingId ? (
                        <Link href={`/onboarding/${c.onboardingId}`} className="text-xs text-muted-foreground hover:text-primary hover:underline">
                          View onboarding
                        </Link>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
