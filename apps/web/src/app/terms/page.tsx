import Link from "next/link";
import { LegalPageLayout, type LegalSection } from "@/components/legal/legal-page-layout";
import { LegalCallout } from "@/components/legal/legal-callout";
import { LegalSubList } from "@/components/legal/legal-sub-list";

const sections: LegalSection[] = [
  {
    id: "acceptance",
    heading: "Acceptance of Terms",
    body: (
      <p>
        By requesting a quote, accepting a quotation, creating a WayTara account, or using the WayTara
        customer dashboard (together, the &quot;Service&quot;), you agree to be bound by these Terms of
        Service (&quot;Terms&quot;), operated by WayTara Energy LLP (&quot;WayTara&quot;, &quot;we&quot;,
        &quot;us&quot;, or &quot;our&quot;). If you do not agree to these Terms, do not use the Service.
      </p>
    ),
  },
  {
    id: "description",
    heading: "Description of Services",
    body: (
      <>
        <p>WayTara designs, quotes, supplies, and installs integrated clean-energy systems — rooftop solar,
          battery energy storage (BESS), and EV charging — for residential, apartment, industrial, commercial,
          and fleet properties, under a single accountable warranty rather than separate vendors for each
          component.</p>
        <p>Once your system is installed, WayTara also provides a monitoring dashboard (the
          &quot;Platform&quot;) so you can track generation, consumption, and system health, raise
          maintenance requests, and manage billing.</p>
      </>
    ),
  },
  {
    id: "eligibility",
    heading: "Eligibility",
    body: (
      <p>
        You must be at least 18 years old, capable of forming a legally binding contract under Indian law,
        and either the owner of the property being surveyed and installed, or authorized by the owner, to
        request a quotation or accept installation services from us.
      </p>
    ),
  },
  {
    id: "quotations",
    heading: "Quotations & Pricing",
    body: (
      <LegalSubList
        items={[
          {
            n: "4.1",
            text: "A quotation prepared for you itemizes hardware, the monitoring plan you selected, applicable GST, and the grand total. It is valid until the date shown on the quotation.",
          },
          {
            n: "4.2",
            text: "You may accept, reject, or request a revision to a quotation via the link sent to your email. Requesting a revision does not create a binding agreement — a new quotation must be accepted before installation proceeds.",
          },
          {
            n: "4.3",
            text: "Prices are based on the site details available at the time of quotation. Material site condition changes discovered during installation (e.g. roof structure, existing wiring) may require a revised quotation before work continues.",
          },
        ]}
      />
    ),
  },
  {
    id: "payment",
    heading: "Payment Terms",
    body: (
      <LegalSubList
        items={[
          {
            n: "5.1",
            text: "On accepting a quotation, you choose to pay the full amount, or 30% of the total as an advance with the remaining balance due at installation.",
          },
          {
            n: "5.2",
            text: "Payments are collected via the payment method shown at checkout, or in person (UPI or cash) at installation for a balance amount.",
          },
          {
            n: "5.3",
            text: "The monitoring plan price is a one-time purchase bundled into your quotation, not a recurring subscription. Moving to a higher plan later is charged only the difference between plans.",
          },
          { n: "5.4", text: "All prices are inclusive of GST at the rate shown on your quotation at the time it was issued." },
          {
            n: "5.5",
            text: "Installation will not be marked complete, nor the balance payment obligation waived, until any outstanding balance is collected.",
          },
        ]}
      />
    ),
  },
  {
    id: "installation",
    heading: "Installation & Site Access",
    body: (
      <>
        <p>You agree to provide our installation team with safe, reasonable access to the property during the
          scheduled installation date and time slot, and to disclose any known site hazards in advance.</p>
        <p>Before installation is scheduled, our team confirms every quoted device against a readiness
          checklist — availability, physical condition, power connection, and a live data test confirming your
          dashboard shows correct readings — so installation only proceeds once everything is verified working.</p>
      </>
    ),
  },
  {
    id: "platform",
    heading: "Monitoring Dashboard & Software Plans",
    body: (
      <>
        <p>Your dashboard access is tied to the monitoring plan (Basic, Pro, or Advance) included in your
          accepted quotation. Each plan unlocks a different set of monitoring, reporting, and alerting
          features.</p>
        <p>The dashboard becomes available once your account is created and your first payment is complete;
          full functionality (live monitoring, historical reports) unlocks once installation is verified
          complete.</p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    heading: "Acceptable Use",
    body: (
      <>
        <p>You agree not to use the Platform to:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Attempt to access another customer&apos;s account, site, or device data</li>
          <li>Interfere with, reverse-engineer, or disrupt the Platform or its underlying infrastructure</li>
          <li>Tamper with installed hardware in a way that could create a safety hazard</li>
          <li>Use the Service for any unlawful purpose under Indian law</li>
        </ul>
        <LegalCallout>Violating this section may result in suspension of dashboard access and does not
          affect your obligation to pay for hardware already installed.</LegalCallout>
      </>
    ),
  },
  {
    id: "ip",
    heading: "Intellectual Property",
    body: (
      <p>
        The WayTara name, logo, dashboard software, and all associated designs and content are the property
        of WayTara Energy LLP. Nothing in these Terms transfers ownership of that intellectual property to
        you. Physical hardware installed at your property becomes your property upon full payment, subject to
        the manufacturer and installation warranties described in our{" "}
        <Link href="/warranty" className="text-theme-highlight hover:underline">Warranty Policy</Link>.
      </p>
    ),
  },
  {
    id: "availability",
    heading: "Service Availability",
    body: (
      <p>
        We aim for high uptime on the monitoring dashboard but do not guarantee uninterrupted access — planned
        maintenance, third-party outages, or connectivity issues at your site can affect availability of live
        data. Dashboard downtime does not affect the physical operation of your installed solar, battery, or EV
        charging hardware.
      </p>
    ),
  },
  {
    id: "liability",
    heading: "Limitation of Liability",
    body: (
      <p>
        To the maximum extent permitted by law, WayTara&apos;s aggregate liability arising from these Terms is
        limited to the amount you paid for the affected system. WayTara is not liable for indirect or
        consequential losses, including lost electricity savings, arising from events outside our reasonable
        control (grid outages, extreme weather, misuse of hardware, or unauthorized modifications).
      </p>
    ),
  },
  {
    id: "termination",
    heading: "Termination",
    body: (
      <p>
        We may suspend dashboard access for a serious breach of these Terms. Suspending dashboard access does
        not remove or affect the physical hardware installed at your property, and does not waive any amount
        you owe us. You may stop using the dashboard at any time; this does not entitle you to a refund for
        hardware already installed.
      </p>
    ),
  },
  {
    id: "governing-law",
    heading: "Governing Law & Jurisdiction",
    body: (
      <p>
        These Terms are governed by the laws of India. Any disputes arising from these Terms are subject to
        the exclusive jurisdiction of the courts of Chennai, Tamil Nadu.
      </p>
    ),
  },
  {
    id: "changes",
    heading: "Changes to These Terms",
    body: (
      <p>
        We may update these Terms from time to time. Material changes will be notified by email to the
        address on your account at least 30 days before taking effect. Continued use of the Service after
        changes take effect constitutes acceptance of the revised Terms.
      </p>
    ),
  },
  {
    id: "contact",
    heading: "Contact",
    body: (
      <div className="rounded-xl border border-theme-border bg-theme-surface p-5">
        <p className="font-medium text-theme-primary">Questions about these Terms?</p>
        <p className="mt-1">
          <a href="mailto:hello@waytaraenergy.com" className="text-theme-highlight hover:underline">
            hello@waytaraenergy.com
          </a>{" "}
          · +91 93630 21195
        </p>
        <p className="mt-1 text-xs text-theme-muted">
          No. 6 &amp; 7, 3rd floor, 5th Street, Dr. Radhakrishnan Salai, Mylapore, Chennai
        </p>
      </div>
    ),
  },
];

export const metadata = {
  title: "Terms of Service | WayTara Energy",
};

export default function TermsPage() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      subtitle="What to expect from WayTara, and what we expect from you, when you get a quote, get installed, and use your monitoring dashboard."
      lastUpdated="September 2026"
      sections={sections}
    />
  );
}
