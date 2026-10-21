# Gateway v3: task list (we tick these off one by one)

Status: `[ ]` to do, `[~]` in progress, `[x]` done and verified. Started 2026-10-21. The 72 h soak of the office board runs meanwhile; board changes (phase 3) restart it.

## Decisions taken (change any of these and the tasks change)
1. **No firmware update for now** (dropped from the plan; the version is still shown on the setup page).
2. **One heartbeat, one place.** A single Supabase job `fleet-tick` every 10 s runs one function that sets every device's status, handles the alerts and calls the hub once (keep-alive and health). Supabase stays the authority; if the hub is down, it still knows.
3. **Offline** = no heartbeat for 30 s (shown at once). **First email** after 2 more minutes still offline (assumed; change to 30 s if you want).
4. **Reminder** every 3 h until acknowledged or back online, then once a day after 24 h (assumed).
5. **Back online** = one email saying how long it was down.
6. **One email at a time:** one digest per customer, at least 10 minutes between device-status emails, one queue entry per event so nothing sends twice.
7. **Hub down:** no device emails; one email to admin only.
8. **Emails are sent by the existing mailer in the dashboard app** (Resend), called by the tick only when the queue has something (assumed).
9. **Customers only** get these emails (open: also the assigned staff?).
10. **The backend does all decoding and encoding** (read: raw words to values; write: value to raw word). The board never converts anything.
11. Docs are written later (your instruction).

## Phase 1: one heartbeat and the alert emails (no board change)
- [x] **T1** Read the current status function, alert tables and email code; write the exact rules and the plan for retiring the old jobs.
- [x] **T2** Database: the email queue ("outbox") table and the alert state it needs, with access rules and tests.
- [x] **T3** Database: the `fleet_tick()` function (statuses, hub-down guard, offline / 3 h / daily / back-online events, digest and 10-minute rules) with tests.
- [x] **T4** Hub: `POST /v1/internal/tick` (shared secret, answers with its health and the number of connected boards) with tests.
- [x] **T5** Dashboard app: the route that sends the queued emails (offline, still offline, back online, hub down) as digests, with tests.
- [ ] **T6** Switch on: create the 10-second `fleet-tick` job and retire `device-status`, `keep-hub-awake` and the offline part of `detect-alerts` (with a rollback).
- [ ] **T7** Live check: unplug and replug the inverter cable, turn the board's Wi-Fi off and on, redeploy the hub; confirm the statuses, the email timeline, one email at a time, and no false emails.

## Phase 2: backend codec, activity log, key and data freshness
- [ ] **T8** One shared codec: encoding for time-of-day settings, 32-bit values and option lists; round-trip tests (value to raw to value) for every setting.
- [ ] **T9** Activity log table in Supabase (who, what, when, source, details) with who-can-see rules, and the hub and apps writing to it.
- [ ] **T10** Push-interval setting: API with limits, the hub applies it, logged in the activity log.
- [ ] **T11** Key workflow: remote two-step rotation (new key sent sealed with the old one), revoke, key states; the "Replace" button removed for boards on Device keys.
- [ ] **T12** "Latest values" pushed to Supabase every 30 to 60 s, and the dashboard Overview uses it.
- [ ] **T13** Go Live: measure click-to-first-value and value-to-value delay, remove the polling delay, tune; target about 2 to 3 s start and about 1 s updates.

## Phase 3: firmware (restarts the soak)
- [ ] **T14** Bluetooth always on, one connection, disconnects itself after about 5 minutes idle; test that Wi-Fi and the hub link stay healthy.
- [ ] **T15** Signed Bluetooth grants: the hub issues a short-lived grant to a signed-in person for one board; the board checks it offline with its own key.
- [ ] **T16** Bluetooth services: device info and version, network and hub status, edit networks, live logs, live readings, register map, push interval, restart.
- [ ] **T17** Test with the bench tester page, flash the board, restart the soak.

## Phase 4: the setup page rebuild
- [ ] **T18** Design system: the dashboard's colours, fonts and logo, light and dark mode, the sidebar and phone drawer, firmware version and "© WayTara Energy" footer.
- [ ] **T19** Sign in, device list by role, one "Scan for units" button (and remembered units), clear "not found" and "no details" handling, unit details.
- [ ] **T20** Pages: Overview, Network, Setup (claim), Key, Status, Live logs, Live readings, Register map, Push interval, Activity log.
- [ ] **T21** Role rules: customer (view, change Wi-Fi), employee/installer (assigned sites, optional end date), admin (all).
- [ ] **T22** Phone and laptop checks, deploy.

## Phase 5: finish
- [ ] **T23** Device keys page and admin screens on the new workflow; customer views.
- [ ] **T24** Test with all four roles (customer, employee, installer, admin).
- [ ] **T25** Restart and complete the 72 h soak with the final firmware.
- [ ] **T26** Documentation (later, as you asked).

## Parked, as before
EV charger, the other 28 settings, Ola Maps key, Render paid plan, hardening, firmware update.

---

## T1 findings: what exists today and the exact rules for the new heartbeat (done 2026-10-21)

**Today, three pieces:** (1) `device-status`, every 10 s: `waytara.refresh_device_status()` re-derives each device's verdict from its last check-in (`equipment_heartbeat`: `online`, `device_unreachable`, `offline` after `max(30 s, 3 x heartbeat_s)`, `never_seen`); triggers set it the moment a check-in arrives and broadcast a live "tick" on `device:<id>`. (2) `detect-alerts`, every 5 min: `waytara.invoke_cron_route('/api/cron/detect-alerts')` calls the dashboard app, which opens and closes rows in `waytara.alerts` (offline, fault, alarm) and e-mails the customer with Resend (`sendDeviceAlertEmail`); critical unacknowledged alerts are e-mailed again every 3 h; a "cleared" e-mail goes out when an alert that was e-mailed closes. (3) `keep-hub-awake`, every 5 min, calls the hub's `/healthz`.

**Two definitions of "offline" today:** the database verdict (30 s) and the alert job's own TypeScript rule (the agent silent for at least 10 minutes, or the device saying it does not answer). The new design has one: the database verdict.

**What stays:** the verdict triggers and the live broadcast; the `alerts` table (`resolved_at`, `acknowledged_at`, `last_notified_at`, `notified_count`) and the dashboard's alert list; the customer's switch `notification_preferences.email_alerts` and the `DEVICE_ALERT_EMAILS=off` switch; the Resend sender and the e-mail wording helpers; `waytara.invoke_cron_route(...)` with the vault secrets `app_base_url` and `cron_secret`; fault and alarm alerts stay in `detect-alerts` for now.

**New rules (all in one database function, `fleet_tick`, every 10 s):**
1. Run the existing verdict refresh first.
2. Ask the hub once (`net.http_post` to `/v1/internal/tick` with a shared secret). The answer to the previous call is read at the next tick (the call is asynchronous): hub up or down, its uptime and how many boards are connected.
3. **Hub down** (3 calls in a row without an answer, about 30 s): open no new offline alerts, send no customer e-mail; queue one admin e-mail "hub down" (after 2 minutes) and one "hub back".
4. **Hub grace:** for 2 minutes after the hub's start (its uptime in the tick answer), do not open offline alerts (boards are still reconnecting).
5. **Offline alert opens** when a monitored device (one that has an agent heartbeat) has had status `offline` or `device_unreachable` for 2 minutes in a row (`status_since`). The dashboard shows the status itself from 30 s. A short blip never opens an alert.
6. **Reminder:** 3 hours after the last e-mail, while the alert is open and not acknowledged; after 24 hours open, once a day.
7. **Back online:** when the status is `online` again, the alert closes; if the customer was e-mailed, one "back online" e-mail says how long it was down.
8. **One e-mail at a time:** events go into an outbox table, one row per event with a unique key (so nothing sends twice). The sender takes every due row of one customer and sends them as one digest, and never sends a customer another device-status e-mail within 10 minutes of the last one.
9. Customers who switched alert e-mails off, deactivated or deleted accounts, and devices without an agent heartbeat get nothing (as today).

**Retired once `fleet-tick` runs:** `device-status` (its function is called inside `fleet_tick`), `keep-hub-awake`, and the offline part of `detect-alerts` (fault and alarm stay).

**Secrets (you set these, I never see them):** `HUB_TICK_SECRET` on Render and the same value in the Supabase vault as `hub_tick_secret`. The mailer route uses the existing `cron_secret`.
