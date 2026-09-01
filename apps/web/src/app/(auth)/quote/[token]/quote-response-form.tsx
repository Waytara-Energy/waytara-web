"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { submitQuoteAccept, submitQuoteReject, submitQuoteRevision } from "./actions";

type Panel = "closed" | "accept" | "reject" | "revise";

// Onboarding pipeline redesign, Phase 4: reveal-with-textarea, matching
// apps/admin's delete-employee-button.tsx pattern — a plain button that
// swaps for an inline confirm/detail panel rather than a modal, scaled to
// this app's size. Three mutually-exclusive panels share one open/closed
// state so only one is ever showing.
export function QuoteResponseForm({ token, totalAmount }: { token: string; totalAmount: number }) {
  const [panel, setPanel] = React.useState<Panel>("closed");
  const [paymentOption, setPaymentOption] = React.useState<"full" | "split">("full");

  const advanceAmount = Math.round(totalAmount * 0.3 * 100) / 100;
  const balanceAmount = Math.round((totalAmount - advanceAmount) * 100) / 100;

  if (panel === "closed") {
    return (
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" className="flex-1" onClick={() => setPanel("accept")}>
          Accept quote
        </Button>
        <Button type="button" variant="outline" className="flex-1" onClick={() => setPanel("revise")}>
          Request changes
        </Button>
        <Button type="button" variant="ghost" className="flex-1" onClick={() => setPanel("reject")}>
          Reject
        </Button>
      </div>
    );
  }

  if (panel === "accept") {
    return (
      <form action={submitQuoteAccept.bind(null, token)} className="space-y-4 rounded-xl border border-theme-border bg-theme-surface p-5">
        <h3 className="text-sm font-semibold text-theme-primary">Choose how you&apos;d like to pay</h3>
        <div className="space-y-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-theme-border p-3 has-[:checked]:border-emerald-500">
            <input
              type="radio"
              name="paymentOption"
              value="full"
              checked={paymentOption === "full"}
              onChange={() => setPaymentOption("full")}
              className="mt-0.5"
            />
            <span className="text-sm text-theme-primary">
              Pay full amount
              <span className="block text-xs text-theme-muted">
                ₹{totalAmount.toLocaleString("en-IN")} now
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-theme-border p-3 has-[:checked]:border-emerald-500">
            <input
              type="radio"
              name="paymentOption"
              value="split"
              checked={paymentOption === "split"}
              onChange={() => setPaymentOption("split")}
              className="mt-0.5"
            />
            <span className="text-sm text-theme-primary">
              Pay 30% now, balance at installation
              <span className="block text-xs text-theme-muted">
                ₹{advanceAmount.toLocaleString("en-IN")} now, ₹{balanceAmount.toLocaleString("en-IN")} at
                installation
              </span>
            </span>
          </label>
        </div>
        <div className="flex gap-2">
          <Button type="submit" className="flex-1">
            Confirm acceptance
          </Button>
          <Button type="button" variant="outline" onClick={() => setPanel("closed")}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  const isReject = panel === "reject";
  const action = isReject ? submitQuoteReject.bind(null, token) : submitQuoteRevision.bind(null, token);

  return (
    <form action={action} className="space-y-3 rounded-xl border border-theme-border bg-theme-surface p-5">
      <h3 className="text-sm font-semibold text-theme-primary">
        {isReject ? "Tell us why you're declining" : "What would you like changed?"}
      </h3>
      <textarea
        name="message"
        rows={3}
        required
        className="w-full rounded-lg border border-theme-border bg-theme-bg px-3 py-2 text-sm text-theme-primary"
        placeholder={
          isReject
            ? "e.g. Going with another provider."
            : "e.g. Could you quote a smaller battery instead?"
        }
      />
      <div className="flex gap-2">
        <Button
          type="submit"
          variant={isReject ? "outline" : "default"}
          className={isReject ? "flex-1 border-theme-alert text-theme-alert hover:bg-theme-alert-subtle" : "flex-1"}
        >
          {isReject ? "Confirm rejection" : "Submit request"}
        </Button>
        <Button type="button" variant="outline" onClick={() => setPanel("closed")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
