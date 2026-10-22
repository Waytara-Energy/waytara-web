# Application Settings (customer app)

`/dashboard/settings`, one section at a time, kept in the address (`#security`). Code: `apps/web/src/components/dashboard/settings/`.

| Section | What it does | Where it is stored |
|---|---|---|
| Profile | Photo (cropped to a square, shrunk in the browser, uploaded to the `avatars` bucket under the person's id), name, phone. E-mail changes only by a 6-digit code sent to the NEW address. | `profiles.avatar_url / full_name / phone`; pending codes in `email_change_codes` |
| Appearance | Light, dark or auto theme; chart style. | the browser (theme cookie / chart cookie) |
| Units | The unit numbers are shown in, for a whole kind (power W/kW/MW, energy Wh/kWh/MWh/MJ, temperature °C/°F/K, voltage V/kV, current mA/A) or for one reading ("particular values"), applied on every dashboard page. Nothing stored or measured changes; downloaded reports (PDF, CSV) and e-mails keep kW/kWh. | `profiles.ui_preferences.units` (`defaults`, `overrides` by reading key) |
| Overview | Which four cards sit beside the energy flow (two each side) out of seven, and a background (six gradients or the person's own picture, with a darken slider). | `profiles.ui_preferences` (`overview_cards`, `overview_background`, `overview_dim`) |
| Notifications | E-mails in five categories, each with its own switch: Account & security (signed in, signed out; password or e-mail changed is always sent), Devices (network connection lost, inverter not answering, back online), Faults & alarms (fault e-mails, alarm e-mails), Billing & plan (tariff changes), Support (ticket updates). | `profiles.notification_preferences`, one true/false per key (`auth_signin`, `auth_signout`, `network_lost`, `device_offline`, `device_online`, `faults`, `alarms`, `tariff`, `support_emails`); an account that had switched the old `email_alerts` off keeps that for the device, fault and tariff e-mails |
| Addresses & billing | Own address, billing address (or "same as my address"), billing e-mail, GST number. | `customers.address / billing_address / billing_email / gstin` |
| Account & security | Password (current one checked first; option to sign every other device out), how long a browser may sit idle (never, 15 min, 30 min, 1 h, 4 h, 1 day) and whether that signs out only that device or all, and the list of signed-in devices with sign out per device / all others / all. | `profiles.security_preferences` (`idle_minutes`, `idle_scope`); sessions are Supabase's own (`auth.sessions`) |

## Units

`lib/unit-prefs.ts` reads the choices and converts a reading for display (`displayValue`), `lib/chart-units.ts` applies them to the trend charts (a different scale and label, totals following the power unit). The dashboard layout holds them in `UnitsProvider`; client components read them with `useUnits()` / `useSeriesUnit()`, and the shared field cards take them as a `units` prop so a server-rendered page can pass `getUnitPrefs()` (`lib/unit-prefs-server.ts`). Covered: Overview cards and flow, Monitoring, Performance, Reports screens, EV cards and charts, the field cards, temperatures. Not converted: marketing pages, PDF/CSV downloads, e-mails, weather, prose descriptions, and a few server-rendered tables (EV session list, cost analytics).

## How the parts work

- **E-mail change.** `requestEmailChange` stores a keyed hash of the code (valid 10 minutes, 5 wrong tries, one resend a minute) and e-mails the code to the new address through Resend; `confirmEmailChange` checks it, then changes the sign-in address through the auth admin API (marked confirmed) and `profiles.email`, and tells the old address. Needs `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` on the web app. Without `RESEND_API_KEY` no code is sent and the person is told so.
- **Idle sign-out.** `IdleSignOut` (mounted in the dashboard layout) keeps the last-activity time in `localStorage` (shared by the tabs of one browser) and signs out when it is older than the person's limit, on the timer, when the tab becomes visible, and on arrival (so a browser reopened after a long absence is signed out at once). It is checked in the browser while the app is open: it cannot sign out a browser that stays closed.
- **Signing out never ends other devices' sessions** unless asked (`signOut({ scope: "local" })`); "other devices" and "all devices" use Supabase's `others` and `global` scopes. Ending one other device's session is `waytara.revoke_my_session` (`auth.sessions` is not readable by the app; `my_sessions()` shows only the caller's own rows).
- **Overview background pictures** live in the same public `avatars` bucket (`<person's id>/overview-<ms>.jpg`); the server action refuses any path outside the person's own folder, and deletes the picture a new one replaces.

## Account e-mails and the switches

`lib/notification-prefs.ts` lists the categories and reads a stored choice (`wants(prefs, key)`). Every sender checks its own key: the alert cron per e-mail (`alertKey`: offline, back online, fault, alarm), the device digest per line (`digestKey`), the tariff cron (`tariff`), the support mailer (`support_emails`), and the account e-mails sent by `lib/auth-notify.ts` after a sign-in (login action), a sign-out (sign-out button, a device ended from Settings, others, all, or idle) and a password change (always sent). They are sent with `after()`, so they never slow the page, and carry the device, the place (Vercel's geo headers, when present), the address and the time.

## My alerts ("tell me when the battery is below 20%")

Settings > Notifications, under the e-mail switches. `lib/alert-rules.ts` has the catalogue: 15 things to watch (battery level, charging and discharging power, battery temperature; solar power and energy today; grid import and export power and energy today; consumption power and energy today; electricity rate, grid cost today, value of the solar energy today) and 13 ready-made alerts. Switched on for everyone from the start: battery below 20% and below 10%, grid import above 5 kW, energy bought today above 15 kWh, grid cost today above ₹150. The rest are off until chosen. A customer can switch any off, change its limit, e-mail/app choices and cooldown, or make alerts of their own (any metric, above or below a limit, one site or all, e-mail and/or the bell, repeat no more often than 15 minutes to a day).

- **Storage:** `alert_rules` (a customer's own alerts, and a row per ready-made alert they changed; RLS: own rows, own sites, at most 60) and `alert_rule_state` (server only: whether a rule is tripped and when it last fired).
- **Evaluation:** `/api/cron/evaluate-alert-rules` every 5 minutes (pg_cron, like the other cron routes). Per customer and site it works out each metric from the latest readings of the site's inverters (readings older than 30 minutes are ignored), then: a limit just crossed and not fired within its cooldown fires once (a row for the bell, and one e-mail listing everything that fired, if the customer keeps "E-mail for my alerts" on); a value back in range by a small margin arms the rule again and marks its bell alert cleared. `?dry=1` reports what would fire and writes nothing.
- Needs `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` and `CUSTOMER_APP_URL` on the web app, like the other jobs.

## Migrations and tests

`20261023050000_my_sessions`, `20261023060000_profile_preferences`, `20261023070000_customer_billing_details`, `20261023080000_alert_rules`; database tests 38, 39 and 40; web tests for `overview-prefs`, `session-policy`, `address`, `email-otp`, `unit-convert`, `user-agent`.

## Not done

- The unit choice is a converter tool, not an app-wide display preference (temperature in °F everywhere, for example).
- Phone numbers are not verified.
- No two-factor sign-in.
- The admin app has no settings page (its sign-out is this-device-only).
