import Link from "next/link";
import { LegalPageLayout, type LegalSection } from "@/components/legal/legal-page-layout";

const sections: LegalSection[] = [
  {
    id: "introduction",
    heading: "Introduction",
    body: (
      <p>
        This Privacy Policy explains how WayTara Energy LLP (&quot;WayTara&quot;, &quot;we&quot;,
        &quot;us&quot;) collects, uses, and protects your information when you request a quote, become a
        customer, and use the WayTara monitoring dashboard.
      </p>
    ),
  },
  {
    id: "information-we-collect",
    heading: "Information We Collect",
    body: (
      <ul className="list-disc space-y-1.5 pl-5">
        <li><span className="text-theme-primary">Contact &amp; account details</span> — name, email, phone,
          address, and password (stored as a salted hash, never in plain text).</li>
        <li><span className="text-theme-primary">Site &amp; property details</span> — property type, power
          source, and the devices installed at your site.</li>
        <li><span className="text-theme-primary">Energy data</span> — generation, consumption, and device
          health readings collected from your installed hardware.</li>
        <li><span className="text-theme-primary">Payment information</span> — handled by our payment
          processor; WayTara stores the transaction record and amount, not full card or bank details.</li>
        <li><span className="text-theme-primary">Support communications</span> — maintenance requests, quote
          responses, and messages you send us.</li>
      </ul>
    ),
  },
  {
    id: "how-we-use-it",
    heading: "How We Use Your Information",
    body: (
      <ul className="list-disc space-y-1.5 pl-5">
        <li>To prepare quotations and schedule installation</li>
        <li>To operate your monitoring dashboard and show your own energy data back to you</li>
        <li>To process payments and maintain your billing history</li>
        <li>To send transactional emails — quotation links, installation scheduling, payment confirmations</li>
        <li>To detect faults (e.g. a device that has stopped reporting) and alert you or our support team</li>
        <li>To comply with legal and tax obligations</li>
      </ul>
    ),
  },
  {
    id: "device-data",
    heading: "Data From Your Solar, Battery & EV Devices",
    body: (
      <p>
        Your installed devices periodically report readings (voltage, output, state of charge, and similar
        metrics) to your dashboard. This data belongs to you and is scoped so that only you, and the WayTara
        staff assigned to your account, can view it. Data generated during pre-installation testing is
        deleted once your system passes verification — it is never mixed with your live energy history.
      </p>
    ),
  },
  {
    id: "sharing",
    heading: "Sharing & Disclosure",
    body: (
      <>
        <p>We do not sell your personal data. We share information only:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>With the WayTara employee assigned to your lead, quotation, or installation</li>
          <li>With our payment processor, solely to complete a transaction you initiate</li>
          <li>With our email provider, solely to deliver transactional emails</li>
          <li>Where required by law, regulation, or a valid legal request</li>
        </ul>
      </>
    ),
  },
  {
    id: "security",
    heading: "Data Security",
    body: (
      <p>
        Access to your data is enforced at the database level — a customer, an installer, and an
        administrator each see only what their role is meant to see, not the whole system. Data is encrypted
        in transit. No method of transmission or storage is 100% secure, but we design access controls
        assuming a compromised front-end should never expose another customer&apos;s data.
      </p>
    ),
  },
  {
    id: "retention",
    heading: "Data Retention",
    body: (
      <p>
        We retain account and energy-usage data for as long as your account is active, and for a reasonable
        period afterward to meet tax, warranty, and legal record-keeping obligations. You may request deletion
        of your account data as described below, subject to those obligations.
      </p>
    ),
  },
  {
    id: "your-rights",
    heading: "Your Rights",
    body: (
      <p>
        You may request access to, correction of, or deletion of your personal data by contacting us at{" "}
        <a href="mailto:contactus@waytaraenergy.com" className="text-theme-highlight hover:underline">
          contactus@waytaraenergy.com
        </a>
        . We will respond within a reasonable time and confirm what we can action, given any active service,
        warranty, or legal obligations tied to your account.
      </p>
    ),
  },
  {
    id: "cookies",
    heading: "Cookies",
    body: (
      <p>
        Our website and dashboard use cookies for sign-in sessions and to remember preferences like your
        chosen theme. See our{" "}
        <Link href="/cookies" className="text-theme-highlight hover:underline">Cookie Policy</Link> for
        details.
      </p>
    ),
  },
  {
    id: "childrens-privacy",
    heading: "Children's Privacy",
    body: (
      <p>
        The Service is intended for property owners and authorized adults. We do not knowingly collect
        personal data from anyone under 18.
      </p>
    ),
  },
  {
    id: "changes",
    heading: "Changes to This Policy",
    body: (
      <p>
        We may update this Privacy Policy from time to time. We&apos;ll update the &quot;Last updated&quot;
        date above, and notify you by email for any change that materially affects how we handle your data.
      </p>
    ),
  },
  {
    id: "contact",
    heading: "Contact",
    body: (
      <div className="rounded-xl border border-theme-border bg-theme-surface p-5">
        <p className="font-medium text-theme-primary">Questions about your data?</p>
        <p className="mt-1">
          <a href="mailto:contactus@waytaraenergy.com" className="text-theme-highlight hover:underline">
            contactus@waytaraenergy.com
          </a>{" "}
          · +91 93848 00141
        </p>
        <p className="mt-1 text-xs text-theme-muted">
          No. 6 &amp; 7, 3rd floor, 5th Street, Dr. Radhakrishnan Salai, Mylapore, Chennai
        </p>
      </div>
    ),
  },
];

export const metadata = {
  title: "Privacy Policy | WayTara Energy",
};

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      subtitle="What information we collect from your account and your installed devices, and how we look after it."
      lastUpdated="September 2026"
      sections={sections}
    />
  );
}
