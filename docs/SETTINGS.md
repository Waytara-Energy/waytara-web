# Application Settings (customer app)

`/dashboard/settings`, one section at a time, kept in the address (`#security`). Code: `apps/web/src/components/dashboard/settings/`.

| Section | What it does | Where it is stored |
|---|---|---|
| Profile | Photo (cropped to a square, shrunk in the browser, uploaded to the `avatars` bucket under the person's id), name, phone. E-mail changes only by a 6-digit code sent to the NEW address. | `profiles.avatar_url / full_name / phone`; pending codes in `email_change_codes` |
| Appearance | Light, dark or auto theme; chart style. | the browser (theme cookie / chart cookie) |
| Overview | Which four cards sit beside the energy flow (two each side) out of seven, and a background (six gradients or the person's own picture, with a darken slider). | `profiles.ui_preferences` (`overview_cards`, `overview_background`, `overview_dim`) |
| Notifications | E-mails: device alerts, support replies, service and maintenance updates. | `profiles.notification_preferences` (`email_alerts`, `support_emails`, `email_maintenance_updates`) |
| Addresses & billing | Own address, billing address (or "same as my address"), billing e-mail, GST number. | `customers.address / billing_address / billing_email / gstin` |
| Account & security | Password (current one checked first; option to sign every other device out), how long a browser may sit idle (never, 15 min, 30 min, 1 h, 4 h, 1 day) and whether that signs out only that device or all, and the list of signed-in devices with sign out per device / all others / all. | `profiles.security_preferences` (`idle_minutes`, `idle_scope`); sessions are Supabase's own (`auth.sessions`) |

The Devices page (Settings tabs) has a **Unit converter** button, and a small calculator beside any numeric setting whose unit it knows (W, kW, V, A, °C ...).

## How the parts work

- **E-mail change.** `requestEmailChange` stores a keyed hash of the code (valid 10 minutes, 5 wrong tries, one resend a minute) and e-mails the code to the new address through Resend; `confirmEmailChange` checks it, then changes the sign-in address through the auth admin API (marked confirmed) and `profiles.email`, and tells the old address. Needs `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` on the web app. Without `RESEND_API_KEY` no code is sent and the person is told so.
- **Idle sign-out.** `IdleSignOut` (mounted in the dashboard layout) keeps the last-activity time in `localStorage` (shared by the tabs of one browser) and signs out when it is older than the person's limit, on the timer, when the tab becomes visible, and on arrival (so a browser reopened after a long absence is signed out at once). It is checked in the browser while the app is open: it cannot sign out a browser that stays closed.
- **Signing out never ends other devices' sessions** unless asked (`signOut({ scope: "local" })`); "other devices" and "all devices" use Supabase's `others` and `global` scopes. Ending one other device's session is `waytara.revoke_my_session` (`auth.sessions` is not readable by the app; `my_sessions()` shows only the caller's own rows).
- **Overview background pictures** live in the same public `avatars` bucket (`<person's id>/overview-<ms>.jpg`); the server action refuses any path outside the person's own folder, and deletes the picture a new one replaces.

## Migrations and tests

`20261023050000_my_sessions`, `20261023060000_profile_preferences`, `20261023070000_customer_billing_details`; database tests 38 and 39; web tests for `overview-prefs`, `session-policy`, `address`, `email-otp`, `unit-convert`, `user-agent`.

## Not done

- The unit choice is a converter tool, not an app-wide display preference (temperature in °F everywhere, for example).
- Phone numbers are not verified.
- No two-factor sign-in.
- The admin app has no settings page (its sign-out is this-device-only).
