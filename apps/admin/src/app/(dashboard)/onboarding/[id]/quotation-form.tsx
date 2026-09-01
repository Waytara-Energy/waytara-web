"use client";

import * as React from "react";
import { Input } from "@waytara/ui/input";
import { Button } from "@waytara/ui/button";
import { createAndSendQuotation } from "./actions";

interface Plan {
  id: string;
  name: string;
  price_monthly: number;
}

interface LineItem {
  description: string;
  qty: number;
  unit_price: number;
}

const DEFAULT_GST_RATE = 18;

export function QuotationForm({ onboardingId, plans }: { onboardingId: string; plans: Plan[] }) {
  const [planId, setPlanId] = React.useState(plans[0]?.id ?? "");
  const [gstRate, setGstRate] = React.useState(DEFAULT_GST_RATE);
  const [items, setItems] = React.useState<LineItem[]>([
    { description: "", qty: 1, unit_price: 0 },
  ]);

  const selectedPlan = plans.find((p) => p.id === planId);
  // The plan is a one-time purchase (see Billing & Plan) — its price is a
  // fixed, non-editable line alongside the employee's own itemized
  // hardware lines, not something an employee can adjust per quote.
  const planPrice = selectedPlan?.price_monthly ?? 0;

  const hardwareTotal = items.reduce((sum, item) => sum + item.qty * item.unit_price, 0);
  const subtotal = hardwareTotal + planPrice;
  const gstAmount = Math.round(subtotal * (gstRate / 100) * 100) / 100;
  const grandTotal = subtotal + gstAmount;

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, { description: "", qty: 1, unit_price: 0 }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const pricingBreakdown = JSON.stringify(
    items
      .filter((item) => item.description.trim())
      .map((item) => ({ ...item, amount: item.qty * item.unit_price }))
  );

  return (
    <form action={createAndSendQuotation.bind(null, onboardingId)} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Monitoring plan (one-time)</label>
        <select
          name="planId"
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
          required
        >
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name} — ₹{plan.price_monthly.toLocaleString("en-IN")}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Hardware &amp; installation</label>
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder="e.g. 5kW Solar Array"
                value={item.description}
                onChange={(e) => updateItem(i, { description: e.target.value })}
                className="flex-[3]"
              />
              <Input
                type="number"
                min={1}
                value={item.qty}
                onChange={(e) => updateItem(i, { qty: Number(e.target.value) || 1 })}
                className="w-16"
              />
              <Input
                type="number"
                min={0}
                placeholder="Unit price"
                value={item.unit_price || ""}
                onChange={(e) => updateItem(i, { unit_price: Number(e.target.value) || 0 })}
                className="w-32"
              />
              <span className="w-28 shrink-0 text-right text-sm text-muted-foreground">
                ₹{(item.qty * item.unit_price).toLocaleString("en-IN")}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeItem(i)}
                disabled={items.length === 1}
              >
                ✕
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          + Add line
        </Button>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Software plan ({selectedPlan?.name ?? "—"})</span>
          <span>₹{planPrice.toLocaleString("en-IN")}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Hardware &amp; installation</span>
          <span>₹{hardwareTotal.toLocaleString("en-IN")}</span>
        </div>
        <div className="flex items-center justify-between text-sm font-medium">
          <span>Subtotal</span>
          <span>₹{subtotal.toLocaleString("en-IN")}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            GST
            <Input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={gstRate}
              onChange={(e) => setGstRate(Number(e.target.value) || 0)}
              className="h-7 w-16 text-xs"
            />
            %
          </span>
          <span>₹{gstAmount.toLocaleString("en-IN")}</span>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="text-sm font-semibold">Grand total</span>
          <span className="text-lg font-semibold">₹{grandTotal.toLocaleString("en-IN")}</span>
        </div>
      </div>

      <input type="hidden" name="pricingBreakdown" value={pricingBreakdown} />
      <input type="hidden" name="gstRate" value={gstRate} />
      <Button type="submit" disabled={!planId || hardwareTotal <= 0}>
        Generate &amp; Send Quotation
      </Button>
    </form>
  );
}
