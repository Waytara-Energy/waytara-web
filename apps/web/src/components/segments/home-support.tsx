"use client";

import * as React from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Place = "tn" | "other";

const PLACES: { id: Place; label: string }[] = [
  { id: "tn", label: "Tamil Nadu" },
  { id: "other", label: "Other states" },
];

// Central PM Surya Ghar assistance plus the Tamil Nadu additional amount, by system size (from the website notes, G.O. (Ms) No.102).
const TN_ROWS = [
  { size: "1 kW", central: "₹30,000", state: "₹5,000", total: "₹35,000" },
  { size: "2 kW", central: "₹60,000", state: "₹10,000", total: "₹70,000" },
  { size: "3 kW and above", central: "₹78,000", state: "₹22,000", total: "₹1,00,000" },
];

/**
 * The home page's government-support block. It is location-aware on purpose: the Tamil Nadu additional amount is shown only under
 * Tamil Nadu, and the "up to ₹1 lakh" figure is never presented as a nationwide subsidy.
 */
export function HomeSupport() {
  const [place, setPlace] = React.useState<Place>("tn");

  return (
    <div>
      <div role="tablist" aria-label="Where is your home?" className="inline-flex rounded-xl border border-theme-border bg-theme-surface p-1">
        {PLACES.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={place === p.id}
            onClick={() => setPlace(p.id)}
            className={cn(
              "rounded-lg px-4 py-1.5 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500",
              place === p.id ? "bg-theme-bg text-theme-highlight shadow-sm" : "text-theme-secondary hover:text-theme-primary"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-theme-border bg-theme-surface">
        {place === "tn" ? (
          <div className="grid grid-cols-1 lg:grid-cols-5">
            <div className="px-7 py-8 sm:px-8 lg:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-theme-muted">Tamil Nadu · eligible residential applications</p>
              <p className="mt-4 text-[clamp(2.5rem,4vw,3.5rem)] font-bold leading-none tracking-tight text-primary-gradient">Up to ₹1 lakh</p>
              <p className="mt-3 text-sm leading-relaxed text-theme-primary">
                Central and state assistance combined for eligible residential rooftop installations of 3 kW and above.
              </p>
            </div>
            <div className="border-t border-theme-border lg:col-span-3 lg:border-l lg:border-t-0">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Assistance by system size in Tamil Nadu</caption>
                <thead>
                  <tr className="border-b border-theme-border text-[11px] uppercase tracking-[0.1em] text-theme-muted">
                    <th scope="col" className="px-6 py-3 font-semibold">System</th>
                    <th scope="col" className="px-3 py-3 font-semibold">Central</th>
                    <th scope="col" className="px-3 py-3 font-semibold">Tamil Nadu</th>
                    <th scope="col" className="px-6 py-3 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {TN_ROWS.map((row) => (
                    <tr key={row.size} className="border-b border-theme-border last:border-b-0">
                      <th scope="row" className="px-6 py-3.5 font-semibold text-theme-primary">{row.size}</th>
                      <td className="px-3 py-3.5 tabular-nums text-theme-secondary">{row.central}</td>
                      <td className="px-3 py-3.5 tabular-nums text-theme-secondary">{row.state}</td>
                      <td className="px-6 py-3.5 text-right font-semibold tabular-nums text-theme-primary">{row.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="px-7 py-8 sm:px-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-theme-muted">PM Surya Ghar · central assistance</p>
            <p className="mt-4 text-[clamp(2.5rem,4vw,3.5rem)] font-bold leading-none tracking-tight text-primary-gradient">Up to ₹78,000</p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-theme-primary">
              For most states, ₹30,000 per kW for the first 2 kW and ₹18,000 for the next 1 kW, capped at ₹78,000. Special-category states have different rates, and
              some states add their own incentives.
            </p>
          </div>
        )}
        <p className="border-t border-theme-border px-7 py-4 text-xs leading-relaxed text-theme-muted sm:px-8">
          Subject to scheme eligibility, approved vendor and equipment requirements, installation and commissioning. The assistance is paid by direct benefit
          transfer after the required process. It is not an upfront discount on your quotation.
        </p>
      </div>

      <a
        href="https://pmsuryaghar.gov.in"
        target="_blank"
        rel="noreferrer"
        className="group mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-theme-highlight underline-offset-4 hover:underline"
      >
        Check your eligibility on the PM Surya Ghar portal
        <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
      </a>
    </div>
  );
}
