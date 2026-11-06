# Every e-mail WayTara sends and receives

Written 2026-11-06 from the code of the customer app (`apps/web`), the admin app (`apps/admin`) and the shared package. It lists what the code does; it cannot show what is set on the hosting (the sender address, switches), so those are marked **check**.

## How mail works

- **Outgoing mail goes through Resend** (one provider for both apps). The sender address is `RESEND_FROM_EMAIL`. **If it is not set, the code falls back to `onboarding@resend.dev`**, Resend's test address, which only delivers to the Resend account owner. **Check** that the production value is an address on a verified WayTara domain.
- **One exception:** the admin app's "Forgot password" uses Supabase's own e-mail (`resetPasswordForEmail`), not Resend. Its look and sender come from the Supabase project's Auth settings, and Supabase's built-in sender is limited to a few e-mails an hour unless a custom mail server is set there. **Check** the Supabase dashboard (Authentication, Emails).
- **Switches:** `DEVICE_ALERT_EMAILS=off` stops device alerts, status digests and tariff e-mails; `SUPPORT_EMAILS=off` stops support e-mails. With no `RESEND_API_KEY` nothing is sent. Customers can also turn most kinds off in Settings, Notifications.
- **Sent after the answer** (the person does not wait, and the host is told to finish the job): the sign-in and sign-out notices, the forgot-password code. The new-lead and partner mails are started without waiting but are **not** registered with the host to finish (see "Things worth deciding", item 6).

## Outgoing: to customers

### Account and security (customer app)

| # | E-mail (subject) | Sent when | To |
|---|---|---|---|
| 1 | `<code> is your WayTara password code` | Someone asks to reset a password (forgot password, or Settings) | The account's address |
| 2 | `<code> is your WayTara verification code` | A customer changes their e-mail address in Settings | The **new** address |
| 3 | The e-mail address of your WayTara account was changed | The e-mail change is confirmed | The **old** address |
| 4 | New sign-in to your WayTara account | A sign-in (if the customer left it on) | The account |
| 5 | Sign-out notices: You signed out of WayTara · You were signed out (idle) · at your session limit · when the browser closed · Your other devices were signed out · You were signed out everywhere · A device was signed out | Each kind of sign-out (if left on) | The account |
| 6 | Your WayTara password was changed | A password is changed (always sent, no switch) | The account |
| 7 | Two-factor sign-in is on / was turned off | Two-factor is switched on or off (always sent) | The account |
| 8 | A test e-mail from WayTara | The customer presses "send a test e-mail" in Settings | The account |
| 9 | Your alert: Test alert | The customer presses "test an alert" | The account |
| 10 | Your WayTara invoice `<number>` (PDF attached) | The customer e-mails an invoice from Billing | The billing address, or the account's |

### Devices and reports (scheduled jobs)

| # | E-mail (subject) | Sent when | To |
|---|---|---|---|
| 11 | Device alert (offline, fault, alarm, recovered; "Reminder: ..." repeats) | The alert job finds something about a device | The customer |
| 12 | Your alert: `<rule>` / `N` of your alerts went off | A rule the customer made fires | The customer |
| 13 | Updates about your devices / `N` of your devices are offline / are back online / `N` of your inverters are not answering | The status job, as a digest | The customer |
| 14 | Electricity rate up / down in `<state>`: your savings now use ₹x/kWh | The daily tariff job (06:00 IST) sees a rate change | Customers with sites in that state |
| 15 | `<report name>` - `<period>` (files attached) | A scheduled report runs, or "send now" | The recipients the customer chose |

### Support tickets (queued, sent by a job)

To the **customer**: We got your ticket · `<person>` replied to your ticket · `<person>` is now handling your ticket · Your ticket is now with `<person>` · Your ticket was marked resolved · Your ticket is closed · Your ticket was reopened.
To the **team member** concerned: New support ticket · `<person>` replied on ticket · Ticket was assigned to you · Ticket moved to `<person>` · Ticket was reopened by the customer · Ticket was closed by the customer (with the rating). Which person gets which comes from the ticket's owner and assignee; each person's notification settings apply.

### Onboarding (sent by the admin app unless noted)

| # | E-mail (subject) | Sent when | To |
|---|---|---|---|
| 16 | Your WayTara quotation is ready | An employee generates or re-sends a quotation | The lead |
| 17 | Thanks for accepting your WayTara quote (PDF attached; sent by the customer app) | The customer accepts the quote on the public page | The customer |
| 18 | Set up your WayTara account | Payment is recorded (or re-sent) | The customer |
| 19 | Your WayTara installation is scheduled | An employee sets the installation date and slot | The customer |
| 20 | Your WayTara system is live | Every device is installed and marked complete | The customer |

### Partners

| # | E-mail (subject) | Sent when | To |
|---|---|---|---|
| 21 | We received your WayTara partner application | The partner form is submitted | The applicant |

## Outgoing: to the WayTara team

| # | E-mail (subject) | Sent when | To |
|---|---|---|---|
| 22 | New lead: `<name>` | Any enquiry form is submitted: contact, planner enquiry, **and the Support page form** (they all save as leads) | `LEADS_NOTIFICATION_EMAIL`, default hello@waytaraenergy.com |
| 23 | New partner application: `<company>` | The partner form is submitted | `PARTNERS_NOTIFICATION_EMAIL`, else the leads address, else hello@ (comma-separated list allowed) |
| 24 | Quote declined: `<name>` / Changes requested: `<name>` | A customer declines or asks for changes on the public quote page | The assigned employee, or an admin |
| 25 | The WayTara hub went down / is back / is not answering | The status job sees the gateway hub's state change | Every active admin who has e-mail alerts on |
| 26 | You're invited to join WayTara Admin | An admin invites an employee | The invited person |
| 27 | Admin "Forgot password" (Supabase's built-in e-mail, not Resend) | A staff member asks to reset a password | The staff address |

## Incoming

**The application receives no e-mail.** There is no inbound mail handler, no mail webhook, and no process that reads a mailbox. What exists:

- **Replies to our e-mails** go to the sender address (`RESEND_FROM_EMAIL`), because **no Reply-To is set** on any message. If that mailbox is not watched, a customer's reply is lost. **Check**, or set a Reply-To of hello@waytaraenergy.com (a small change; I can do it).
- **The public mailbox hello@waytaraenergy.com** (shown in the footer, the Contact and Support pages, the legal pages and `llms.txt`) is read by people. The new-lead and new-partner mails also land there.
- **Form submissions are the real "incoming"**: contact, planner enquiry and Support form go to `/api/leads` (saved, then mail #22); the partner form goes to `/api/partners` (saved, then #21 and #23); support tickets are created inside the dashboard (then the ticket mails above).

## Things worth deciding

1. **Enquirers get no confirmation.** Someone who sends the contact, planner or Support form receives nothing back (only partner applicants do, #21). Every form requires an e-mail address, so an "We received your message" mail is easy to add.
2. **The Support form creates a "lead".** A support request arrives as "New lead: ..." with a source, not as a ticket. That is worth a look, because tickets have their own queue and mails.
3. **Reply-To** (see above), and the **sender address** check.
4. **Admin forgot-password** uses a different mailer from everything else; moving it onto the same sender would make staff mail consistent.
5. **Six senders in the customer app and five in the admin app each call Resend themselves** instead of the shared sender, so a change of sender, Reply-To or footer has to be made in eleven places.
6. **New-lead and partner e-mails may be lost.** `/api/leads` and `/api/partners` start the e-mail with `void ...` and then return. On Vercel a function can be frozen as soon as the answer is sent, so the e-mail can be cut off half-way: the lead is saved, but the team's "New lead" mail sometimes never arrives. Wrapping those calls in `after()` (as the sign-in notices already are) fixes it. I have not changed it, because you asked for the list; I recommend doing it.
