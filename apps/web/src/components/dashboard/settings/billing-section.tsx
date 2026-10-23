"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { ArrowRight, BarChart3, FileText, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddressesSection } from "./addresses-section";
import { PlanCard, type PlanSummary } from "./plan-card";
import { SettingsCard } from "./settings-card";

export interface BillingProps {
  plan: PlanSummary | null;
  addresses: ComponentProps<typeof AddressesSection>;
}

/** Settings > Billing: the plan, where the bills and statements are, and the addresses and billing details printed on them. */
export function BillingSection({ plan, addresses }: BillingProps) {
  return (
    <div className="space-y-5">
      <div className="grid items-start gap-5 xl:grid-cols-2">
        {plan ? <PlanCard plan={plan} /> : null}
        <SettingsCard title="Bills and statements" description="Your payments, and the monthly statements of what your system made and used." icon={Receipt} tone="sky">
          <ul className="-my-1 divide-y divide-border">
            <li>
              <Link href="/dashboard/billing#payments" className="flex items-center gap-3 py-3 text-sm font-medium text-foreground transition-colors hover:text-emerald-600 dark:hover:text-emerald-400">
                <Receipt className="size-4 text-muted-foreground" />
                <span className="min-w-0 flex-1">Payment history</span>
                <ArrowRight className="size-3.5 text-muted-foreground" />
              </Link>
            </li>
            <li>
              <Link href="/dashboard/reports" className="flex items-center gap-3 py-3 text-sm font-medium text-foreground transition-colors hover:text-emerald-600 dark:hover:text-emerald-400">
                <FileText className="size-4 text-muted-foreground" />
                <span className="min-w-0 flex-1">Monthly statements and reports</span>
                <ArrowRight className="size-3.5 text-muted-foreground" />
              </Link>
            </li>
            <li>
              <Link href="/dashboard/performance" className="flex items-center gap-3 py-3 text-sm font-medium text-foreground transition-colors hover:text-emerald-600 dark:hover:text-emerald-400">
                <BarChart3 className="size-4 text-muted-foreground" />
                <span className="min-w-0 flex-1">What you saved</span>
                <ArrowRight className="size-3.5 text-muted-foreground" />
              </Link>
            </li>
          </ul>
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href={`/dashboard/support?${new URLSearchParams({ new: "1", category: "billing", subject: "Question about my billing" })}`}>Ask about billing</Link>
          </Button>
        </SettingsCard>
      </div>
      <AddressesSection {...addresses} />
    </div>
  );
}
