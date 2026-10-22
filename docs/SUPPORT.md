# Support tickets

A customer opens a ticket on one of their sites. It goes to the **team of that site**: the site's installer (site engineer), the site's employees and the admins. Anyone of them can take it or hand it to someone else on the team. The customer is e-mailed at every step.

## What happens

| Event | Thread line | E-mail to the customer | E-mail to staff |
|---|---|---|---|
| Customer opens a ticket | | "We got your ticket" | New ticket, to the whole team |
| Someone takes it (or answers it) | "Ivan took this ticket" | "Ivan is now handling your ticket" | |
| Handed to someone else | "Asha reassigned this ticket from Ivan to Emil" | "Your ticket is now with Emil" | The new person ("assigned to you"); the previous one ("moved") |
| Staff reply | the message | "Ivan replied" (held 45 s, dropped if already read in the app, merged if several) | |
| Customer reply | the message | | The person handling it, or the whole team while nobody does |
| Staff mark it resolved | "marked this ticket as resolved" | "Resolved: close or reopen it" | |
| Customer closes it (stars + comment) / reopens it | "closed this ticket and rated it 5" / "reopened" | | The person handling it (or the team) |
| Staff close it | "closed this ticket" | "Closed: rate your experience" (the customer can rate later) | The person handling it, when the customer rates |

Messages carry up to 5 files (10 MB each). Staff can write **internal notes** the customer never sees (their files live in `<ticket>/internal/`, which the customer cannot read). "Seen" is one mark per side on the ticket: the other side opened it after the message was written.

## Where it lives

- **Database** (`20261023010000_support_v2.sql`, `..._names.sql`, `..._internal_files.sql`): nothing is written directly. Every change goes through the `support_*` functions (create, send, attach, take, assign, set status, close, reopen, rate, mark read), which check who may do what. Tickets, messages and files are read through row-level rules (`support_staff_can_access`). E-mails are queued in `support_notifications` (one row per event and person, unique key, claimed before sending).
- **Customer app**: `/dashboard/support` (list, new ticket, conversation).
- **Admin app**: `/support` (tabs Unassigned / Mine / All open / Closed) and `/support/<id>` (conversation, take, hand over, status, details, rating). A **site engineer** can sign in to the admin app and sees only Support.
- **Shared** (`packages/ui`): `support-model`, `support-client`, `support-ui`, `use-support-thread`. The screens of both apps are built from them.
- **Mailer**: `apps/web` route `/api/cron/send-support-notifications`. The database calls it the moment an e-mail is due (`_support_kick`, through `invoke_cron_route`), and a job (`send-support-notifications`) calls it every minute as a safety net.

## To go live

1. Apply the three migrations (done on the live database on 2026-10-23).
2. Deploy `apps/web` (the mailer route) and `apps/admin`.
3. On the web app: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CUSTOMER_APP_URL`, `ADMIN_APP_URL` (the buttons in the e-mails lead to these), `CRON_SECRET` (as for the other cron routes). `SUPPORT_EMAILS=off` switches the e-mails off.
4. Site engineers must be assigned to the site (Site access page) to see its tickets.

A customer can switch support e-mails off with `notification_preferences.support_emails = false`; staff e-mails are always on.
