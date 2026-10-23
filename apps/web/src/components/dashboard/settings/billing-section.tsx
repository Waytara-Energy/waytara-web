"use client";

import * as React from "react";
import Link from "next/link";
import type { ComponentProps } from "react";
import { CircleCheck, Download, Eye, FileSpreadsheet, LifeBuoy, Mail, Receipt, Wallet, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { paymentTypeLabel, type PaymentRow, type PaymentSummary } from "@/lib/billing-summary";
import { hasInvoice, invoiceNumber, paymentsCsv } from "@/lib/invoice";
import { inr } from "@/lib/savings";
import { AddressesSection } from "./addresses-section";
import { InvoiceDialog, sendInvoiceByEmail } from "./invoice-dialog";
import { PlanCard, type PlanSummary } from "./plan-card";
import { Pill, SettingsCard, TwoColumns } from "./settings-card";

export interface BillingProps {
  plan: PlanSummary | null;
  payments: PaymentRow[];
  summary: PaymentSummary;
  addresses: ComponentProps<typeof AddressesSection>;
}

const PAYMENT_BADGE: Record<string, "default" | "alert" | "secondary"> = { paid: "default", pending: "alert", failed: "alert", refunded: "secondary" };
const dateText = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
const HELP = `/dashboard/support?${new URLSearchParams({ new: "1", category: "billing", subject: "Question about my billing" })}`;

/** Settings > Billing (it was the Billing & Plan page): the plan and subscription, what was paid and what is waiting, the full payment
 *  history, and the addresses and billing details printed on the bills. Billing questions go to Support. */
export function BillingSection({ plan, payments, summary, addresses }: BillingProps) {
  const [open, setOpen] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState<string | null>(null);

  async function email(id: string) {
    setSending(id);
    await sendInvoiceByEmail(id);
    setSending(null);
  }

  function exportCsv() {
    const url = URL.createObjectURL(new Blob([`\uFEFF${paymentsCsv(payments)}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "waytara-payments.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <TwoColumns
        left={plan ? <PlanCard plan={plan} /> : <NoPlan />}
        right={
        <SettingsCard title="Payments" description="What you have paid for your system." icon={Wallet} tone="sky">
          <div className="grid grid-cols-3 gap-3">
            <Tile label="Total paid" value={inr(summary.paid)} />
            <Tile label="Payments" value={String(summary.count)} />
            <Tile label="Waiting" value={summary.pending > 0 ? inr(summary.pending) : "—"} warn={summary.pending > 0} />
          </div>
          {summary.pending > 0 && (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-sm text-amber-800 dark:text-amber-200">
              {inr(summary.pending)} is waiting to be paid. If you have already paid it, it can take a little while to show here.
            </p>
          )}
          <p className="text-xs text-muted-foreground">{summary.lastPaidAt ? `Last payment on ${dateText(summary.lastPaidAt)}.` : "No payment has gone through yet."}</p>
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href={HELP}>
              <LifeBuoy className="size-3.5" />
              Ask about a payment or my plan
            </Link>
          </Button>
        </SettingsCard>
        }
      />

      <SettingsCard
        title="Payment history"
        description={summary.lastPaidAt ? `Every payment, newest first, with its invoice. Last payment on ${dateText(summary.lastPaidAt)}.` : "Every payment, newest first, with its invoice."}
        icon={WalletCards}
        tone="teal"
        badge={payments.length > 0 ? <Pill>{payments.length}</Pill> : undefined}
        footer={
          payments.length > 0 ? (
            <Button type="button" variant="outline" size="sm" onClick={exportCsv}>
              <FileSpreadsheet className="size-3.5" />
              Export as CSV
            </Button>
          ) : undefined
        }
      >
        {payments.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Receipt />
              </EmptyMedia>
              <EmptyTitle>No payments yet</EmptyTitle>
              <EmptyDescription>Payments you make will show up here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="hidden sm:table-cell">Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                  <TableHead className="text-right">Invoice</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-foreground">
                      {paymentTypeLabel(p.payment_type)}
                      {hasInvoice(p.status) && <span className="block text-xs font-normal text-muted-foreground">{invoiceNumber(p.id, p.paid_at ?? p.created_at)}</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{dateText(p.paid_at ?? p.created_at)}</TableCell>
                    <TableCell className="hidden capitalize text-muted-foreground sm:table-cell">{p.method ? p.method.replace(/_/g, " ") : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums text-foreground">{inr(Number(p.amount))}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={PAYMENT_BADGE[p.status] ?? "secondary"} className="capitalize">
                        {p.status === "paid" && <CircleCheck className="mr-1 size-3" />}
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {hasInvoice(p.status) ? (
                        <div className="flex justify-end gap-1">
                          <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => setOpen(p.id)} aria-label={`View the invoice of ${paymentTypeLabel(p.payment_type)}`}>
                            <Eye className="size-3.5" />
                            <span className="hidden sm:inline">View</span>
                          </Button>
                          <Button asChild variant="ghost" size="sm" className="h-8 px-2">
                            <a href={`/api/account/invoice/${p.id}?download=1`} download aria-label={`Download the invoice of ${paymentTypeLabel(p.payment_type)}`}>
                              <Download className="size-3.5" />
                              <span className="hidden sm:inline">PDF</span>
                            </a>
                          </Button>
                          <Button type="button" variant="ghost" size="sm" className="h-8 px-2" disabled={sending === p.id} onClick={() => void email(p.id)} aria-label={`E-mail the invoice of ${paymentTypeLabel(p.payment_type)} to me`}>
                            <Mail className="size-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">After it is paid</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SettingsCard>

      <AddressesSection {...addresses} />

      <InvoiceDialog paymentId={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function Tile({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={warn ? "rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3" : "rounded-xl border border-border bg-muted/30 px-3.5 py-3"}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-xl font-semibold tracking-tight text-foreground">{value}</p>
    </div>
  );
}

function NoPlan() {
  return (
    <SettingsCard title="Your plan" description="What you bought, and your ongoing monitoring and dashboard access." tone="violet">
      <p className="text-sm text-muted-foreground">No plan assigned yet. Your WayTara advisor sets this up during installation.</p>
    </SettingsCard>
  );
}
