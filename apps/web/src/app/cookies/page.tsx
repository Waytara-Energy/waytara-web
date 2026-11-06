import Link from "next/link";
import { LegalPageLayout, type LegalSection } from "@/components/legal/legal-page-layout";
import { LegalCallout } from "@/components/legal/legal-callout";
import { LegalContact } from "@/components/legal/legal-contact";
import { Strong } from "@/components/legal/legal-list";
import { LegalClauses } from "@/components/legal/legal-sub-list";
import { pageMetadata } from "@/lib/seo";

const LINK = "text-theme-highlight underline-offset-4 hover:underline";

interface Stored {
  name: string;
  what: string;
  how: string;
  kept: string;
}

/** Everything the website and dashboard store in your browser. Kept in step with the code: add a line here when something new is stored. */
const SIGN_IN: Stored[] = [
  {
    name: "Sign-in cookies (names start with sb-)",
    what: "Keep you signed in to the dashboard and recognise you from one page to the next. Without them the dashboard cannot work.",
    how: "Cookie, set by our sign-in provider when you sign in",
    kept: "While you are signed in, and until you sign out or the session ends",
  },
];

const PREFERENCES: Stored[] = [
  {
    name: "theme and theme_auto",
    what: "Remember whether you chose the light or the dark look, or to follow your device.",
    how: "Browser storage",
    kept: "Until you clear your browser data",
  },
  {
    name: "sidebar_state",
    what: "Remembers whether the dashboard's side menu is open or closed.",
    how: "Cookie",
    kept: "Up to 7 days",
  },
  {
    name: "selected_site_id and selected_device_id",
    what: "Remember which site and device you were looking at in the dashboard.",
    how: "Cookie",
    kept: "Up to 1 year",
  },
  {
    name: "chart_style",
    what: "Remembers the chart style you picked, and is used when we make a report PDF for you.",
    how: "Cookie",
    kept: "Up to 1 year",
  },
  {
    name: "waytara:range:…",
    what: "Remembers the date range you chose on a dashboard page while you move between pages.",
    how: "Session storage",
    kept: "Until you close the tab",
  },
];

function StoredList({ items }: { items: Stored[] }) {
  return (
    <ul className="space-y-5">
      {items.map((s) => (
        <li key={s.name}>
          <p className="font-semibold text-theme-primary">{s.name}</p>
          <p className="mt-1">{s.what}</p>
          <p className="mt-1 text-sm text-theme-muted">
            {s.how}. Kept: {s.kept.charAt(0).toLowerCase() + s.kept.slice(1)}.
          </p>
        </li>
      ))}
    </ul>
  );
}

const sections: LegalSection[] = [
  {
    id: "what",
    heading: "What this page covers",
    body: (
      <>
        <p>
          Cookies are small files a website saves in your browser. Browser storage does the same job and is covered here too. This page lists everything the WayTara website and
          dashboard save in your browser, and why.
        </p>
        <LegalCallout>
          <p>
            <Strong>We use no advertising cookies and no tracking cookies.</Strong> Nothing here follows you to other websites, and nothing here is sold or shared for advertising.
          </p>
        </LegalCallout>
      </>
    ),
  },
  {
    id: "needed",
    heading: "Needed to sign in",
    body: (
      <>
        <p>These are needed for the dashboard to work. They are only set when you sign in.</p>
        <StoredList items={SIGN_IN} />
      </>
    ),
  },
  {
    id: "choices",
    heading: "Remembering your choices",
    body: (
      <>
        <p>These remember a choice you made so you do not have to make it again. They hold no personal details.</p>
        <StoredList items={PREFERENCES} />
      </>
    ),
  },
  {
    id: "measure",
    heading: "Measuring the website",
    body: (n) => (
      <LegalClauses
        section={n}
        items={[
          "We count visits and how fast pages load using a measurement service that does not use cookies. It does not build a profile of you and does not follow you across other websites.",
          "We also count how far people get in the energy planner, such as which step they reached. These counts are not linked to your name or contact details.",
          "If something breaks, an error-reporting service receives technical details of the fault, such as the page and the browser. It does not record what you see or type.",
        ]}
      />
    ),
  },
  {
    id: "third-parties",
    heading: "Other companies' content",
    body: (
      <p>
        Maps on our pages are loaded from map providers, and the WhatsApp and social links take you to those sites. When your browser contacts them, they can see that it did and may set
        their own cookies under their own policies. We do not control those.
      </p>
    ),
  },
  {
    id: "control",
    heading: "Your control",
    body: (n) => (
      <>
        <LegalClauses
          section={n}
          items={[
            "You can delete cookies and browser storage, or block them, in your browser's settings.",
            "If you block the sign-in cookies, you cannot stay signed in to the dashboard. The public pages still work.",
            "If you block or delete the others, the site still works, but it will forget your choices, such as the theme or the site you were looking at.",
          ]}
        />
      </>
    ),
  },
  {
    id: "changes",
    heading: "If this changes",
    body: (
      <p>
        If we add something that stores data in your browser, we will add it to this list first, and change the date at the top. If it is anything other than what is needed for the
        site to work, we will ask you before we set it. How we handle personal data in general is in the{" "}
        <Link href="/privacy" className={LINK}>
          Privacy Policy
        </Link>
        .
      </p>
    ),
  },
  {
    id: "contact",
    heading: "Contact",
    body: <LegalContact question="Questions about cookies?" />,
  },
];

export const metadata = pageMetadata({
  title: "Cookie Policy",
  description: "Everything the WayTara website and dashboard store in your browser, and why. No advertising or tracking cookies.",
  path: "/cookies",
});

export default function CookiesPage() {
  return (
    <LegalPageLayout
      name="Cookie Policy"
      path="/cookies"
      title="Cookie"
      accent="Policy."
      intro="Everything the website and dashboard save in your browser, and why."
      lastUpdated="6 November 2026"
      inShort={[
        "We use no advertising cookies and no tracking cookies.",
        "Sign-in cookies keep you signed in to the dashboard. Without them it cannot work.",
        "A few small settings remember your theme, side menu, site and chart choices.",
        "Visits are counted without cookies.",
      ]}
      sections={sections}
    />
  );
}
