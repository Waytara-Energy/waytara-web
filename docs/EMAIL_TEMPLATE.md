# The standard WayTara e-mail

Every e-mail either app sends is built on one layout: `packages/ui/src/mail-layout.ts` (import it as `@waytara/ui/mail-layout`). It makes the HTML and the plain-text version from the same pieces, so they never drift apart.

## What every e-mail has

- The WayTara logo at the top (from `https://www.waytaraenergy.com/images/logo.png`, so it shows in every inbox).
- A short green rule and the title.
- The greeting, the body, and at most one button, then "- The WayTara Team".
- A help line (Support and hello@waytaraenergy.com).
- **Quick links** that depend on who the e-mail is for: customers get My dashboard, Support, Settings and WhatsApp; the team gets the Admin app and the website; people who are not signed in (applicants, quote recipients) get the Energy planner, Platform, Support and WhatsApp.
- Why the person got it, the Privacy Policy and Terms of Service links, the Mylapore address and the copyright line.
- A phone layout (less side padding), and a hidden "preview line" an inbox shows beside the subject.

There are no social icons on purpose: only WhatsApp is a real, confirmed channel today. Add social links to `quickLinks()` once the real account addresses are known.

## How to write an e-mail

```ts
import { renderMail } from "@waytara/ui/mail-layout";

const { html, text } = renderMail({
  preheader: "Your code works for 10 minutes.",   // shown beside the subject
  title: "Your password code",
  greeting: "Hi Priya,",
  blocks: [
    { type: "p", text: "Use this code to change your password." },
    { type: "code", code: "482915" },
    { type: "note", text: "If you did not ask for this, ignore this e-mail." },
  ],
  button: { label: "Open Settings", url: "https://www.waytaraenergy.com/dashboard/settings" },
  why: "You get this e-mail because someone asked to change your password.",
  audience: "customer", // or "team" (with adminUrl) or "public"
});
// send { subject, html, text }
```

Block types: `p` (paragraph), `h` (small heading), `code` (a one-time code), `facts` (label and value rows), `quote` (a message someone wrote), `note` (quieter small print), `list` (bullets). Everything you pass in is escaped for you, so a name or a message can never inject HTML.

## Where it is used

All 27 e-mails: the account and security mails, the sign-in and sign-out notices, device alerts, the status digest, tariff and report mails, the support-ticket mails, the partner mails, the new-lead and quote mails, the test mail and the invoice (customer app), and the five onboarding and invite mails (admin app).

The one exception is the admin app's "Forgot password", which Supabase sends itself; its look is set in the Supabase dashboard (Authentication, Email templates). The same layout can be pasted there: ask and I will produce it.

## Look at it

Run `pnpm --filter waytara-web vitest run src/lib/mail-layout.test.ts` for the tests. To see an e-mail in a browser, write `renderMail(...).html` to a file and open it.
