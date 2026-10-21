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
- [x] **T6** Switch on: create the 10-second `fleet-tick` job and retire `device-status`, `keep-hub-awake` and the offline part of `detect-alerts` (with a rollback).
- [ ] **T7** (moved to the end by the user: do it last) Live check: unplug and replug the inverter cable, turn the board's Wi-Fi off and on, redeploy the hub; confirm the statuses, the email timeline, one email at a time, and no false emails.

## Phase 2: backend codec, activity log, key and data freshness
- [x] **T8** One shared codec: encoding for time-of-day settings, 32-bit values and option lists; round-trip tests (value to raw to value) for every setting.
- [x] **T9** Activity log table in Supabase (who, what, when, source, details) with who-can-see rules, and the hub and apps writing to it.
- [x] **T10** Push-interval setting: API with limits, the hub applies it, logged in the activity log.
- [x] **T11** Key workflow (split in four, below):
  - [x] **T11a** Database: key rotations (two keys valid side by side while the new one is delivered, one rotation at a time, cancel if it does not finish), with tests.
  - [x] **T11b** Hub: remote two-step rotation (new key sent sealed with the old one, the unit confirms, then the old key is cut), revoke, and the old "replace" refused for units; tests with a simulated unit.
  - [x] **T11c** Firmware: accept the staged key and the commit, switch keys without a restart (built and compiled now, flashed with phase 3).
  - [x] **T11d** Admin Device keys page: key states, "Rotate key" (only when the unit is online and can do it), "Cut off", no more "Replace" for units; plain explanations.
- [x] **T12** "Latest values" pushed to Supabase every 30 to 60 s, and the dashboard Overview uses it.
- [ ] **T13** Go Live: measure click-to-first-value and value-to-value delay, remove the polling delay, tune; target about 2 to 3 s start and about 1 s updates. (Built 2026-10-21; ticks when the measured numbers are in, see the T13 record.)

## Phase 3: firmware (restarts the soak)
- [ ] **T14** Bluetooth always on, one connection, disconnects itself after about 5 minutes idle; test that Wi-Fi and the hub link stay healthy. (Built and compiled 2026-10-21; the on-board test happens with T17, see the T14 record.)
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

## T6 record (2026-10-21, 13:53 IST)
`fleet-tick` (pg_cron, every 10 s, `select waytara.fleet_tick()`) is running; `device-status` and `keep-hub-awake` were removed in the same transaction; `detect-alerts` (every 5 min) stays for faults and alarms only. First check: no failed runs, hub up, 1 board connected, nothing queued. **Rollback** if ever needed: `select cron.unschedule('fleet-tick'); select cron.schedule('device-status', '10 seconds', $$select waytara.refresh_device_status()$$); select cron.schedule('keep-hub-awake', '*/5 * * * *', $$select net.http_get(url := 'https://hub.waytaraenergy.com/healthz', timeout_milliseconds := 60000)$$);` and restore the offline handling in `apps/web/src/app/api/cron/detect-alerts/route.ts` (or the customer would get no offline alerts).

## T8 record (2026-10-21)
The backend codec is the only place that converts: `core/decode.ts` (raw words to values) and `core/setting-value.ts` (value to raw word, and the read-back to the log's text), with the allow-list built by `core/register-map.ts`. Checked against all 63 writable settings of the live catalogue (a fixture exported from it, `test/fixtures/write-catalogue.json`): 20 plain numbers, 8 scaled numbers, 23 yes/no bit fields, 4 plain yes/no, 1 option list, 6 times of day, 1 clock. Found and fixed: the six time-of-day start times were not in the board's allow-list at all (any setting with a decode "note" was excluded), so they could not be written; they now are (HHMM digits 0000 to 2359, minutes under 60, checked on encode). Still not writable by a single-register command, on purpose: the inverter clock (three packed registers). 32-bit values: no writable setting needs one today. Unverified settings stay refused until verified (Tuesday work). The change makes the register map's hash change, so the board downloads a new map after the next backend deploy.

## T9 record (2026-10-21)
`waytara.device_activity` (+ the view `waytara.device_activity_log`) is the one "who did what, when" history. Filled by triggers on the tables that already know: key events (unit set up, key replaced, key cut off, unit released), site access (granted with its end date, removed), offline alerts (offline, back), and setting changes (requested, confirmed by the inverter, not taken). The setup page adds what only it knows through `waytara.log_device_activity()` (Wi-Fi changed or removed, restart, push interval): a customer may log Wi-Fi changes and restarts on their own unit, only staff the push interval, a secret in the details is refused, a claim cannot be faked from the page (the trigger writes it). Visible to: the customer who owns the site, staff assigned to it (an ended assignment shows nothing) and admins; customers do not get the technical details or the address. Each trigger swallows its own errors so a log problem never stops the action. Tests: 26_device_activity (22).

## T10 record (2026-10-21)
The push interval (how often the averaged 15-minute figures and the latest values of a unit are written to Supabase) lives in `gateway_equipment_settings.upload_interval_s`. New: `gw_get_push_interval` / `gw_set_push_interval` (backend identity only; the person must manage the unit; allowed 60, 120, 300, 600, 900, 1800 or 3600 s; the change is written to the activity log with the old and new value), the hub's `GET` and `PUT /v1/equipment/:id/push-interval`, and `IngestService.reloadProfile()` so a connected unit takes it at once. Tests: 27_push_interval (10), push-interval.test.ts (6), 2 in ingest.test.ts. The setup page's Push interval screen (T20) is the user of this.

## T11 design (2026-10-21): why a key, and how it changes safely
**Why a key:** it is the unit's identity and its secret. It proves a message comes from this unit, makes it unreadable to anyone else, and lets us cut off a stolen unit. **Set** when someone with access sets the unit up (setup page, Finish): the hub makes it and hands it to the unit sealed to the unit's own one-time key; nobody ever sees it. **Today a change locks the unit out:** the new key can only reach the unit through setup over Bluetooth.
**New rotation (two steps, no downtime):** (1) the hub makes the new key and both keys are valid side by side; (2) the hub sends the new key to the unit sealed with the old key (only that unit can read it); (3) the unit stores it aside and answers "staged"; (4) the hub sends "commit"; (5) the unit switches to the new key without restarting (the buffered readings stay) and reconnects; (6) the hub sees the unit log in with the new key and cuts the old one. If the unit does not finish within 10 minutes, the rotation is cancelled by the database, the new key is cut and the old key stays: nothing is lost, and the activity log says so. Only one rotation at a time per unit.
**Cut off (revoke):** for a lost or stolen unit: it stops at once and needs a fresh setup. **Replace** is no longer offered for units (it caused the lockout); chargers keep their typed-in key and Replace.

## T11 record (2026-10-21)
**Done:** database (T11a: `key_rotations`, both keys valid side by side, one open change per unit, the database cancels an unfinished one after 10 minutes and keeps the old key, `gw_open_rotation`), hub (T11b: `RotationService`, `GET`/`POST /v1/equipment/:id/rotation`, the old "Replace" of a unit's key refused with 409 `use_key_change`), firmware (T11c, 0.3.0: caps `rotate_key`, stage, commit, switch without a reboot, previous key kept until the new one has held for 30 s, automatic way back after 90 s of network time, survives a power cut during the trial), admin Device keys page (T11d: key state, "Rotate key" with a plain confirmation and progress, "Cut off" for a lost unit, "Release unit", no more "Make a key"/"Replace" for units, a link to the setup page for a unit with no key; chargers unchanged).
**Not yet verified on hardware:** the firmware is compiled but NOT flashed (the 72 h soak runs on 0.2.9). Until it is flashed no unit says it can do a key change, so the hub refuses to start one ("This unit's software cannot change its key remotely yet"), which is the safe state. To verify: flash 0.3.0, press Rotate key on the Device keys page, watch the board's log for "kept aside", "switching", "the new key is in use", and the page for "The key was changed"; then try the failure paths (cut Wi-Fi during the change; the unit must stay on its old key). The admin page changes have been type-checked, linted and built but not looked at in a browser (they need an admin sign-in).

## T12 record (2026-10-21)
The hub now pushes the latest values of a unit to the database every 30 s (only what changed, with the running figures of the unfinished bucket) through `gw_ingest_summaries`, whose broadcast the dashboards already consume: no database or dashboard change was needed. The regular push (the push interval) is unchanged and is the only thing that acknowledges readings. To see it: open the dashboard Overview with Go Live off; the values should move about every 30 s instead of every 15 minutes (after the next hub deploy).

## T13 record (2026-10-21)
Built, not yet measured. What changed:
- **Dashboard** (`go-live.tsx`): the request to the database (`request_live`) is sent at once, in parallel with joining the live channel (it used to wait for the channel), and the moment it is stored the page sends `POST /v1/equipment/:id/live-wake` to the hub.
- **Hub**: the wake-up route (same access rule as the cadence reports, answers 202 at once) makes the Go Live check run immediately instead of at the next 3 s check; the unit is told to stream within a fraction of a second. The hub also writes how each session went to `equipment_live_timing` (one row per unit): `request_to_command_ms`, `command_to_first_frame_ms`, `first_frame_to_tick_ms`, `request_to_first_tick_ms`, and `ticks`, `avg_gap_ms`, `max_gap_ms` (the refresh rhythm).
- **Firmware 0.3.0-t13**: while live, readings that are normally read every 10 s or quicker are read every 2 s, and a Go Live press brings the next read forward to within 2 s. Compiled, not flashed (the soak runs on 0.2.9), so until it is flashed the rhythm stays at the unit's normal 5 s.
**To measure:** deploy the hub, open a dashboard, press Go Live, wait about 30 s, then read the row: `select * from waytara.equipment_live_timing;`. Target: `request_to_first_tick_ms` about 2 to 3 s, `avg_gap_ms` about 1 s to 2 s (5 s on unflashed firmware). Tick T13 once the numbers are in and tuned.

## T14 record (2026-10-21)
Firmware 0.3.0-t14 (compiled, NOT flashed; repo `waytara-gateway-fw`, branch `feat/gateway-fw`):
- Bluetooth starts at boot and advertises all the time as `WayTara-<last 6>`; one connection at a time; a fresh key pair for every phone.
- The unit disconnects a phone that sends nothing authenticated for 5 minutes (`BLE_IDLE_MS`; the page keeps a session alive with the new `ping` command) and one that has not agreed the encrypted link within 30 seconds (`BLE_HANDSHAKE_MS`), so a passer-by cannot hold the only slot.
- The hub link is no longer paused and the unit no longer restarts after every phone session. Only commands that open their own secure connection (`checks`, `speed`, `claim`, `wifi`) pause the hub link while they run; it comes back at the next 20 s round. The unit restarts after a session only if that session changed the setup (claim, networks, hub address, factory reset).
- Safety until T15: without an open setup window (BOOT for 3 s, no Wi-Fi/key at start, or 10 min without network) a connected phone can only `info` and `ping`; everything that changes the unit is refused with a plain message. T15 adds signed grants as the second way in.
**Main risk to check on the board:** memory. Bluetooth, the hub link (TLS) and the page's commands now live together. After flashing, connect with the bench page, read `info` (`heap_free`, `heap_largest`) with and without a phone connected, run `checks`, and watch that `hub_link` is true again within about 20 s and Wi-Fi stays up; leave a phone idle for 5 minutes and see it let go.
