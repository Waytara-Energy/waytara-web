import Link from "next/link";
import { LegalPageLayout, type LegalSection } from "@/components/legal/legal-page-layout";

const sections: LegalSection[] = [
  {
    id: "what-are-cookies",
    heading: "What Are Cookies",
    body: (
      <p>
        Cookies are small text files stored on your device when you visit a website. They let a site remember
        who you are between page loads, or remember a preference like your chosen theme.
      </p>
    ),
  },
  {
    id: "how-we-use-cookies",
    heading: "How We Use Cookies",
    body: (
      <p>
        WayTara uses cookies to keep you signed in to your dashboard, to remember your light/dark theme
        preference, and to understand which pages of our public site are useful. We do not use cookies to
        build advertising profiles or sell your browsing activity to third parties.
      </p>
    ),
  },
  {
    id: "types-we-use",
    heading: "Types of Cookies We Use",
    body: (
      <ul className="list-disc space-y-1.5 pl-5">
        <li><span className="text-theme-primary">Strictly necessary</span> — keeps you signed in to your
          dashboard; the Service does not work without these.</li>
        <li><span className="text-theme-primary">Functional</span> — remembers your theme (light/dark)
          preference across visits.</li>
        <li><span className="text-theme-primary">Analytics</span> — helps us understand aggregate traffic to
          our public site, so we can improve it. This never includes your dashboard or energy data.</li>
      </ul>
    ),
  },
  {
    id: "third-party",
    heading: "Third-Party Cookies",
    body: (
      <p>
        Some pages may load content from third-party services (for example, embedded maps). Those services
        may set their own cookies, governed by their own privacy policies, not this one.
      </p>
    ),
  },
  {
    id: "managing-preferences",
    heading: "Managing Your Cookie Preferences",
    body: (
      <p>
        Most browsers let you block or delete cookies through their settings. Blocking strictly necessary
        cookies will prevent you from staying signed in to your dashboard. Blocking functional cookies just
        means your theme preference won&apos;t be remembered between visits.
      </p>
    ),
  },
  {
    id: "changes",
    heading: "Changes to This Policy",
    body: (
      <p>
        We may update this Cookie Policy as the Service changes. Check back here for the current version; see
        also our{" "}
        <Link href="/privacy" className="text-theme-highlight hover:underline">Privacy Policy</Link> for how
        we handle the data cookies help us collect.
      </p>
    ),
  },
  {
    id: "contact",
    heading: "Contact",
    body: (
      <div className="rounded-xl border border-theme-border bg-theme-surface p-5">
        <p className="font-medium text-theme-primary">Questions about cookies?</p>
        <p className="mt-1">
          <a href="mailto:contactus@waytaraenergy.com" className="text-theme-highlight hover:underline">
            contactus@waytaraenergy.com
          </a>
        </p>
      </div>
    ),
  },
];

export const metadata = {
  title: "Cookie Policy | WayTara Energy",
};

export default function CookiesPage() {
  return (
    <LegalPageLayout
      title="Cookie Policy"
      subtitle="What cookies WayTara's website and dashboard use, and why."
      lastUpdated="September 2026"
      sections={sections}
    />
  );
}
