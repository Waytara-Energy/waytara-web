"use client";

import * as React from "react";
import { CircleCheck, Download, Mail } from "lucide-react";
import { notify } from "@waytara/ui/notify";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ButtonSpinner } from "@/components/ui/spinner";
import type { InvoiceData } from "@/lib/invoice";
import { emailInvoice, getInvoice } from "@/app/dashboard/settings/billing-actions";

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

type Loaded = { id: string; invoice: InvoiceData | null; error: string | null };

/** E-mails the invoice of a payment to the billing e-mail; shared by the table and the dialog. */
export async function sendInvoiceByEmail(paymentId: string): Promise<boolean> {
  try {
    const r = await emailInvoice(paymentId);
    notify.success(`Invoice sent to ${r.sentTo}.`);
    return true;
  } catch (e) {
    notify.error(e instanceof Error ? e.message : "The invoice could not be sent.");
    return false;
  }
}

/** The invoice of one payment, shown like a bill on a sheet, with Download (the PDF) and an e-mail button. `paymentId` null keeps it closed. */
export function InvoiceDialog({ paymentId, onClose }: { paymentId: string | null; onClose: () => void }) {
  const [loaded, setLoaded] = React.useState<Loaded | null>(null);
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    if (!paymentId) return;
    let alive = true;
    getInvoice(paymentId)
      .then((invoice) => alive && setLoaded({ id: paymentId, invoice, error: null }))
      .catch((e: unknown) => alive && setLoaded({ id: paymentId, invoice: null, error: e instanceof Error ? e.message : "The invoice could not be loaded." }));
    return () => {
      alive = false;
    };
  }, [paymentId]);

  const ready = paymentId !== null && loaded?.id === paymentId ? loaded : null;
  const invoice = ready?.invoice ?? null;

  async function email() {
    if (!paymentId) return;
    setSending(true);
    await sendInvoiceByEmail(paymentId);
    setSending(false);
  }

  return (
    <Dialog open={paymentId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{invoice ? `Invoice ${invoice.number}` : "Invoice"}</DialogTitle>
          <DialogDescription>{invoice ? `Paid on ${day(invoice.issuedAt)}` : "Your invoice for this payment."}</DialogDescription>
        </DialogHeader>

        {!ready && (
          <div className="space-y-3" aria-busy>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}
        {ready?.error && <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{ready.error}</p>}

        {invoice && (
          <>
            <div className="space-y-5 rounded-xl border border-border bg-card p-5 text-sm">
              <div className="grid gap-4 sm:grid-cols-2">
                <Party title="From" name={invoice.seller.name} lines={[...invoice.seller.address, invoice.seller.email ?? "", invoice.seller.gstin ? `GSTIN: ${invoice.seller.gstin}` : ""]} />
                <Party title="Billed to" name={invoice.buyer.name} lines={[...invoice.buyer.address, invoice.buyer.email ?? "", invoice.buyer.billingEmail && invoice.buyer.billingEmail !== invoice.buyer.email ? invoice.buyer.billingEmail : "", invoice.buyer.gstin ? `GSTIN: ${invoice.buyer.gstin}` : ""]} />
              </div>

              <div className="rounded-lg border border-border">
                <div className="flex items-start justify-between gap-4 border-b border-border bg-muted/40 px-3.5 py-2 text-xs font-medium text-muted-foreground">
                  <span>Description</span>
                  <span>Amount</span>
                </div>
                <div className="flex items-start justify-between gap-4 px-3.5 py-3">
                  <div>
                    <p className="font-medium text-foreground">{invoice.description}</p>
                    {invoice.quotationRef && <p className="text-xs text-muted-foreground">As per quotation #{invoice.quotationRef}</p>}
                  </div>
                  <span className="tabular-nums text-foreground">{inr(invoice.amounts.taxable)}</span>
                </div>
              </div>

              <dl className="ml-auto w-full max-w-xs space-y-1.5">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Value before tax</dt>
                  <dd className="tabular-nums">{inr(invoice.amounts.taxable)}</dd>
                </div>
                {invoice.amounts.gstRate ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">GST @ {invoice.amounts.gstRate}%</dt>
                    <dd className="tabular-nums">{inr(invoice.amounts.gst)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                  <dt>Total paid</dt>
                  <dd className="tabular-nums">{inr(invoice.amounts.total)}</dd>
                </div>
              </dl>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg bg-muted/40 px-3.5 py-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                  <CircleCheck className="size-4" />
                  Paid
                </span>
                <span>{invoice.payment.typeLabel}</span>
                {invoice.payment.method && <span className="capitalize">by {invoice.payment.method.replace(/_/g, " ")}</span>}
                {invoice.payment.reference && <span>Ref. {invoice.payment.reference}</span>}
                {invoice.progress && (
                  <span>
                    Paid so far {inr(invoice.progress.paidToDate)} of {inr(invoice.progress.quotationTotal)}
                    {invoice.progress.remaining > 0 ? `, ${inr(invoice.progress.remaining)} to go` : ", fully paid"}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">Prices include GST. Questions: {invoice.seller.email}.</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" disabled={sending} onClick={() => void email()}>
                  <ButtonSpinner show={sending} />
                  {!sending && <Mail className="size-3.5" />}
                  E-mail it to me
                </Button>
                <Button asChild size="sm">
                  <a href={`/api/account/invoice/${paymentId}?download=1`} download>
                    <Download className="size-3.5" />
                    Download PDF
                  </a>
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Party({ title, name, lines }: { title: string; name: string; lines: string[] }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="font-semibold text-foreground">{name}</p>
      {lines.filter(Boolean).map((l) => (
        <p key={l} className="text-muted-foreground">
          {l}
        </p>
      ))}
    </div>
  );
}
