import { LegalPageLayout, type LegalSection } from "@/components/legal/legal-page-layout";
import { LegalCallout } from "@/components/legal/legal-callout";
import { LegalSubList } from "@/components/legal/legal-sub-list";

const sections: LegalSection[] = [
  {
    id: "overview",
    heading: "Overview",
    body: (
      <p>
        Every WayTara installation is covered by a single, accountable warranty across your whole system —
        solar panels, inverter, battery storage, and EV charger — rather than separate warranties from
        separate vendors that point fingers at each other when something goes wrong. If a covered issue
        affects your system, WayTara is who you call.
      </p>
    ),
  },
  {
    id: "whats-covered",
    heading: "What's Covered",
    body: (
      <LegalSubList
        items={[
          { n: "2.1", text: "Manufacturing defects in hardware supplied by WayTara." },
          { n: "2.2", text: "Workmanship of the installation itself — wiring, mounting, and connections carried out by our installation team." },
          {
            n: "2.3",
            text: "Performance issues confirmed by your dashboard's monitoring data, where the fault is traced back to the installed hardware rather than external factors (grid conditions, shading changes, etc.).",
          },
        ]}
      />
    ),
  },
  {
    id: "warranty-periods",
    heading: "Warranty Periods",
    body: (
      <>
        <p>Standard coverage periods, unless a longer period is stated on your specific quotation:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Solar panels — manufacturer performance warranty as stated on your quotation</li>
          <li>Inverters and battery storage — manufacturer warranty as stated on your quotation</li>
          <li>EV charger hardware — manufacturer warranty as stated on your quotation</li>
          <li>Installation workmanship — 12 months from the date installation is marked complete</li>
        </ul>
        <p className="text-xs text-theme-muted">
          Exact terms vary by the equipment quoted for your site — always refer to the warranty period printed
          on your accepted quotation and installation confirmation, which supersede the general periods above.
        </p>
      </>
    ),
  },
  {
    id: "not-covered",
    heading: "What's Not Covered",
    body: (
      <>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Physical damage from accidents, natural disasters, fire, or pest damage</li>
          <li>Modifications, repairs, or add-ons not performed or approved by WayTara</li>
          <li>Normal wear and tear, or gradual performance degradation within manufacturer-specified limits</li>
          <li>Damage from failing to maintain safe, agreed site access for scheduled maintenance</li>
          <li>Issues caused by grid instability or conditions outside the installed system itself</li>
        </ul>
        <LegalCallout>
          Unauthorized modification of installed hardware voids the warranty on the affected component.
        </LegalCallout>
      </>
    ),
  },
  {
    id: "claims",
    heading: "Claim Process",
    body: (
      <p>
        Raise a maintenance request from your dashboard describing the issue — your monitoring data (device
        status, recent readings) is attached automatically, which helps us diagnose faster. Our team will
        review, and where needed, schedule a site visit to inspect the affected hardware.
      </p>
    ),
  },
  {
    id: "repair-replacement",
    heading: "Repair & Replacement",
    body: (
      <p>
        Where a claim is approved, we will repair or replace the affected component at no cost to you, at
        WayTara&apos;s discretion. Replacement parts may be equivalent rather than identical models where the
        original is no longer available.
      </p>
    ),
  },
  {
    id: "limitations",
    heading: "Limitations",
    body: (
      <p>
        This warranty covers repair or replacement of the affected hardware and does not cover indirect losses
        (such as electricity costs incurred while a fault is being resolved). It is provided in addition to,
        not instead of, your other rights under applicable Indian consumer protection law.
      </p>
    ),
  },
  {
    id: "contact",
    heading: "Contact",
    body: (
      <div className="rounded-xl border border-theme-border bg-theme-surface p-5">
        <p className="font-medium text-theme-primary">Need to raise a warranty claim?</p>
        <p className="mt-1 text-sm text-theme-secondary">
          Sign in to your dashboard and open Maintenance, or reach us directly:
        </p>
        <p className="mt-1">
          <a href="mailto:hello@waytaraenergy.com" className="text-theme-highlight hover:underline">
            hello@waytaraenergy.com
          </a>{" "}
          · +91 93630 21195
        </p>
      </div>
    ),
  },
];

export const metadata = {
  title: "Warranty Policy | WayTara Energy",
};

export default function WarrantyPage() {
  return (
    <LegalPageLayout
      title="Warranty Policy"
      subtitle="One accountable warranty across your solar, battery, and EV charging system — not a separate one per vendor."
      lastUpdated="September 2026"
      sections={sections}
    />
  );
}
