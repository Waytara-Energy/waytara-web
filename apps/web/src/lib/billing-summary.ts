// What the Billing & Plan page shows from the customer's payments and subscription: totals, the label of each payment and how far
// into the subscription period they are. Plain functions so the page and its test share them.

export interface PaymentRow {
  id: string;
  payment_type: string;
  amount: number | string;
  status: string;
  method: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface PaymentSummary {
  /** the sum of the payments that went through (rupees) */
  paid: number;
  /** the sum of those still waiting (rupees) */
  pending: number;
  count: number;
  /** when the latest paid one was made */
  lastPaidAt: string | null;
}

export function summarisePayments(payments: readonly PaymentRow[]): PaymentSummary {
  let paid = 0;
  let pending = 0;
  let lastPaidAt: string | null = null;
  for (const p of payments) {
    const amount = Number(p.amount) || 0;
    if (p.status === "paid") {
      paid += amount;
      const at = p.paid_at ?? p.created_at;
      if (!lastPaidAt || at > lastPaidAt) lastPaidAt = at;
    } else if (p.status === "pending") {
      pending += amount;
    }
  }
  return { paid, pending, count: payments.length, lastPaidAt };
}

const TYPE_LABEL: Record<string, string> = { full: "Full payment", advance: "Advance", balance: "Balance" };
export const paymentTypeLabel = (type: string): string => TYPE_LABEL[type] ?? type.replace(/_/g, " ");

export const SUBSCRIPTION_LABEL: Record<string, string> = { trialing: "Trial", active: "Active", past_due: "Payment due", cancelled: "Cancelled" };

const DAY_MS = 86_400_000;

/** How far into the current subscription period `now` is: the share elapsed (0 to 100) and the whole days left; null without both dates. */
export function periodProgress(start: string | null, end: string | null, now: number): { percent: number; daysLeft: number } | null {
  if (!start || !end) return null;
  const from = Date.parse(start);
  const to = Date.parse(end);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return null;
  const percent = Math.min(100, Math.max(0, Math.round(((now - from) / (to - from)) * 100)));
  return { percent, daysLeft: Math.max(0, Math.ceil((to - now) / DAY_MS)) };
}
