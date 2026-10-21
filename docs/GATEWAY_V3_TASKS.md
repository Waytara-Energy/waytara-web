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
- [~] **T7** (moved to the end by the user: do it last; cable pull and hub redeploy verified 2026-10-21, only the Wi-Fi off and on is left) Live check: unplug and replug the inverter cable, turn the board's Wi-Fi off and on, redeploy the hub; confirm the statuses, the email timeline, one email at a time, and no false emails.

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
- [x] **T13** Go Live: measure click-to-first-value and value-to-value delay, remove the polling delay, tune; target about 2 to 3 s start and about 1 s updates. (Measured 2026-10-21: start 2.2 s; the update rhythm stays about 5 s until the firmware with the 2 s Go Live reads is flashed, see the T13 record.)

## Phase 3: firmware (restarts the soak)
- [~] **T14** (verified on the board: always on, memory and hub link healthy with a phone connected; the 5-minute idle disconnect is not tested yet) Bluetooth always on, one connection, disconnects itself after about 5 minutes idle; test that Wi-Fi and the hub link stay healthy. (Built and compiled 2026-10-21; the on-board test happens with T17, see the T14 record.)
- [x] **T15** (verified on the board: a customer got View and Wi-Fi, an admin ("Arun", 17:46) got the administrator level, both logged; the employee and installer service level shares the same code path and was not tried with a real login) Signed Bluetooth grants: the hub issues a short-lived grant to a signed-in person for one board; the board checks it offline with its own key. (Built 2026-10-21: hub, database and firmware compiled; the on-board test happens with T17, see the T15 record.)
- [x] **T16** (verified on the board by the user as admin: live logs, register map and the other pages; not exercised: join and forget a network, restart, and the push-interval Save is not evidenced in the hub, which still shows 900 s with no change logged) Bluetooth services: device info and version, network and hub status, edit networks, live logs, live readings, register map, push interval, restart. (Firmware built and compiled 2026-10-21; the on-board test happens with T17, see the T16 record.)
- [x] **T17** (done 2026-10-21 with the real setup page instead of the bench page; moved to the END by the user, 2026-10-21: the board is not at hand; do it with T7 and T25) Test with the bench tester page, flash the board, restart the soak.

## Phase 4: the setup page rebuild
- [x] **T18** Design system: the dashboard's colours, fonts and logo, light and dark mode, the sidebar and phone drawer, firmware version and "© WayTara Energy" footer.
- [x] **T19** Sign in, device list by role, one "Scan for units" button (and remembered units), clear "not found" and "no details" handling, unit details.
- [x] **T20** Pages: Overview, Network, Setup (claim), Key, Status, Live logs, Live readings, Register map, Push interval, Activity log.
- [x] **T21** Role rules: customer (view, change Wi-Fi), employee/installer (assigned sites, optional end date), admin (all).
- [x] **T22** Phone and laptop checks, deploy. (Looked at on laptop and phone widths in the browser; waiting for the push and the hub and Vercel deploys.)

## Phase 5: finish
- [x] **T23** Device keys page and admin screens on the new workflow; customer views. (Admin: new Device activity page; customer: a Recent activity card on the Devices page; the Device keys page is the T11d one.)
- [~] **T24** Test with all four roles (customer, employee, installer, admin). (Done at the database and page-rule level, see the T23 and T24 record; the real sign-ins and the Bluetooth part wait for the board, T17.)
- [~] **T25** (running since 2026-10-21 17:37 IST, report due 2026-10-24 about 17:40) Restart and complete the 72 h soak with the final firmware.
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

## T15 record (2026-10-21)
How a person gets in over Bluetooth now (firmware 0.3.0-t15, hub route live after the next hub deploy, database function already live):
1. The page connects (the unit is always advertising), reads the unit's public key for this connection, and asks the hub: `POST /v1/equipment/:id/ble-grant` with `{"pub": "<base64url>"}` and the person's sign-in token.
2. The hub decides the level from who the person is (`gw_ble_access`): admin = **4 admin**, assigned employee or site engineer = **3 service**, the customer who owns the site = **2 network**; anybody else gets a plain 404. Each granted request is written to the activity log (`bluetooth_access`). The hub refuses while the unit is changing its key (409) or has no key (409).
3. The hub returns a 62-byte grant: version, level, expiry (2 minutes), a hash of the unit's public key for this connection, the unit id, the person id, and a 16-byte HMAC made with a key derived from the unit's equipment key. The page sends it to the unit with the `auth` command.
4. The unit checks it by itself (no network): signature, that it is for this unit and this connection (a grant cannot be replayed on another connection), the level, and the expiry when its clock is set. Three bad grants in one connection and it disconnects the phone.
What each level may do on the unit: 0 (none) `ping`, `auth`; 1 `info`; 2 `scan`, `wifi`, `forget`; 3 `checks`, `speed`, `hub`, `reboot`; 4 `claim`, `factory`. The open setup window (BOOT for 3 s) still counts as level 4, so a unit with no key or a lost key can still be reached by someone standing next to it. T16 adds the new services at these levels.
Proof the two sides agree: `test-vectors/ble-grant.json` (backend) is turned into `vectors.h` for the board's `selftest` command (new grant checks: right level, expiry, no clock, another unit, another connection, changed level, another key). The backend side passes; **run `selftest` on the board after flashing**.

## T16 record (2026-10-21)
Firmware 0.3.0-t16 (compiled, NOT flashed). The commands a signed-in phone can send over the encrypted Bluetooth link, with the grant level each needs (T15):
| Service | Command | Level | What it does |
|---|---|---|---|
| Device info and version | `info` | 1 view | hardware id, firmware version, claimed or not, equipment id, hub address, clock, memory, Wi-Fi, saved networks, hub link, the level the phone has |
| Network and hub status | `status` | 1 view | boot number, uptime, Wi-Fi (name, signal, channel, address), clock, hub link, inverter online, share of successful reads, rounds, failures, dead registers, queued frames, sent and acknowledged numbers, dropped frames, map version and size, free memory |
| Edit networks | `scan`, `wifi`, `forget` | 2 network | as before; the hub link is paused only while a `wifi` command runs |
| Live readings | `live` {on} | 1 view | the newest round of Modbus reads as RAW words (`{live: round, t, b: [[start, "hex words"]], more}`); the unit never converts them, the page or the backend decodes them with the register map. While it is on the fast values are read every 2 s (as in Go Live); it stops when the phone leaves |
| Live logs | `logs` {on, backlog} | 3 service | the unit's log lines (`{log: [[number, text]]}`), the last 30 first. Every log line is kept in a ring of 64 lines |
| Register map | `map` {kind: r or w, from} | 3 service | the map the hub sent, a page at a time: what is read (start, count, seconds) or what may be written (register, mask, low, high) |
| Restart | `reboot` | 3 service | restarts the unit |
| Keep the session | `ping` | none | counts as activity so the 5-minute idle limit does not apply while the page is open |
The **push interval** needs no firmware service: it is a setting of the hub (`GET/PUT /v1/equipment/:id/push-interval`, T10), so the page uses that API (a unit without internet keeps its last value). The static RAM use grew from 32% to 37% (log ring and live buffer); check free memory on the board with `status` while a phone is connected.

## T18 to T21 record (2026-10-21)
The setup page (repo `ESP32-S3-GUI`, folder `D:Manoj-WaytaraESP32-S3 GUI`) was rebuilt; see its README for the page list. What the rest of the system got for it:
- **Database** (applied live, test `31_unit_by_hardware`, 7 of 7): `waytara.my_unit_by_hardware(hardware id)` returns the device, its name and its site for the signed-in person only (the owner, assigned staff, admins); an unknown unit and somebody else's look the same. This is how a customer's phone finds which device a unit belongs to, since only staff can read `gateway_devices`.
- **Hub**: `POST /v1/equipment/:id/decode` turns raw register words (as the unit shows them live over Bluetooth) into values with the stored readings' rules, so the page decodes nothing itself; a customer gets only what the customer view shows; 90 requests a minute per person; 3 tests. The page also uses `ble-grant` (T15), `push-interval` (T10) and `rotation` (T11).
- **Page**: sign-in, one Scan button, remembered units, grant request and presentation, nine unit and hub pages, light and dark, sidebar and phone drawer, footer with the firmware version and the copyright line. 50 tests with a fake unit that follows the firmware's access levels. Wi-Fi edits are written to the activity log (never the password).
**Not verified with a real unit** (the board is not at hand): the whole Bluetooth path (grant, levels, status, live readings, logs, map). That is part of T17. **Deploy order:** push; redeploy the hub on Render (new `decode` and `ble-grant` routes); the page builds on Vercel from the repository (its `ALLOWED_ORIGINS` and Content-Security-Policy already allow the hub and Supabase).

## T23 and T24 record (2026-10-21)
**T23.** Admin app: a **Device activity** page (`/activity`, in the menu after Device keys): the newest 200 rows of `device_activity_log` with the device and site, who, what and when, a source filter, and the detail and address in each row's expandable part. Admins see every device; an employee sees the sites they are assigned to (the view's row security decides; the page adds no rule). Customer dashboard: a **Recent activity** card at the bottom of the Devices page: the newest ten sentences with the person's name and time, without technical detail (the view hides it from customers). Both type-check and lint clean; not looked at in a browser (they need sign-ins).
**T24, database level (live, rolled back): `32_four_roles` 22 of 22.** Customer, employee, installer (site engineer) and admin against what the page and hub rely on: Bluetooth level (customer network, employee and installer service, admin admin), finding a unit by hardware id, who may manage keys and the push interval (not the customer), and the activity log (admin and staff see the detail and address, the customer only the sentence). An assignment that has ended, another customer, and staff at another site get nothing. **Page level:** `roles.test` (6) and the connect-flow tests (7) cover the menu per level and each outcome. **Left for the board (T17):** signing in as each of the four on the real page and connecting over Bluetooth to see the unit's own level checks (they are covered by the firmware, compiled but not flashed).

## T13 measurement (2026-10-21 16:18, Deye 8 kW, firmware still 0.2.9)
One clean press (every other dashboard tab closed, the hub with the timing fix and the dashboard with the instant wake-up both deployed):
| Step | Time |
|---|---|
| Press until the hub tells the unit to stream | 0.76 s (was 3.1 s before the wake-up) |
| Unit told until its first reading | 1.34 s (waiting for the unit's next read) |
| First reading until the value is on the dashboard's channel | 0.16 s |
| **Press until the first value** | **2.25 s** (first measurement before the change: 4.17 s; target 2 to 3 s) |
| Gap between updates once running | average 4.9 s, longest 6.2 s (17 updates in 80 s) |
The start meets the target. The update rhythm is the unit's own 5-second read cycle: the firmware built for T13 (0.3.0-t13 and later, in the T16 build) reads the fast values every 2 s while somebody watches, which should bring it to about 2 s; it is not flashed yet (T17), so re-measure `avg_gap_ms` after flashing. A target of about 1 s would need the inverter read every second; whether the Deye answers that fast is a question for the board test.
Two traps when measuring: the database keeps ONE Go Live request per unit, so any dashboard tab left open (or an old tab) keeps the session going and the next press does not start a new one; wait until `select count(*) from waytara.equipment_live_requests where until > now()` is 0 before pressing.

## Board day: the order for T17, T7, T25 and the real-unit parts of T24
Everything below needs the office board (hardware id 2884855505D0, the Deye 8 kW inverter b4c30eb8-fba4-4487-aa7a-3c1b089e36e2, Wi-Fi "Waytara Office"). The hub (commit 1314580 or later), the dashboard and the setup page are already deployed. Before starting, if the 72 h soak from 2026-10-21 11:00 IST is still running and you want its verdict, run the soak report first (see the memory note); flashing restarts the board and ends it.
1. **Flash.** Quit the Arduino IDE completely (it holds the port). Plug the board in (it shows up as a COM port, COM4 last time). From `waytara-gateway-fw` run `arduino-cli compile` then `upload` with FQBN `esp32:esp32:esp32s3:FlashSize=16M,PartitionScheme=app3M_fat9M_16MB,PSRAM=opi,CDCOnBoot=cdc,UploadSpeed=115200` (upload speed 115200; if a block at 0x5E000 fails, use `--no-stub`). The last full backup is `D:Manoj-Waytaraackupsesp32-office-before-a6-20261015.bin` (old firmware and its secrets; never commit it). Settings and the key survive a flash that only replaces the app.
2. **Self-test.** `toolsserial-run.ps1 -Port COM4 -Commands "status","selftest"`: all checks must pass, in particular the new `grant:` lines (they prove the board and the hub sign and read Bluetooth grants the same way). Check the log shows firmware `waytara-gw-0.3.0-t16`, that it joins Wi-Fi, and that the hub link comes up (the dashboard shows it online within a minute).
3. **Memory with Bluetooth always on (the main risk).** Without a phone connected, `status` over serial: note free heap. Then connect with the bench page (`tools/setup-test.html`, hold BOOT 3 s, or the real setup page) and read `info`/`status` again with the phone connected: the hub link must stay up (`hub_link` true), Wi-Fi must stay up, free heap must not fall near zero. Run `checks` and `speed` from the page: the hub link pauses for them and must be back within about 20 s. Leave a connected phone idle for 5 minutes: the board must let go of it by itself.
4. **Setup page against the real unit (T19 to T21, T24).** In Chrome: sign in, press Add a unit once (the browser's one-time window), then see the unit appear on the radar by itself on the next visit. Connect as each of the four people (customer: Wi-Fi and view only; employee and installer assigned to the site: service pages; admin: everything). The unit must refuse what the level does not allow. Check Status, Live readings (values match the inverter screen), Live logs, Register map, Network (add and forget a test network, then restore the real one), Device name, Push interval, and that Wi-Fi edits and restarts appear in the activity log.
5. **Key change (T11).** Admin app, Device keys page: Rotate key on the online unit. Watch the board log for "kept aside", "switching", "the new key is in use", and the page for "The key was changed". Then try the failure path: start a change and cut the Wi-Fi; the unit must stay on its old key and the change must cancel after 10 minutes.
6. **Go Live rhythm (T13).** With nobody else watching, press Go Live and read `equipment_live_timing`: `avg_gap_ms` should now be about 2000 (it was 4911 on the old firmware).
7. **T7 live checks.** Unplug and replug the RS485 cable, turn the Wi-Fi off and on, redeploy the hub. Check the device status, the email timeline (offline after 30 s, first email after 2 more minutes, back-online email with the downtime), one email at a time, and no false emails while the hub restarts.
8. **T25.** Start the 72 h soak again from the final firmware and run the soak report when it is over (pass = no gaps over 2 minutes except planned ones, a reading about every 5 s, no unexpected hub restarts).
9. Afterwards: tick T7, T14 to T17, T24, T25 and write what was found into the records; then the documentation (T26).

## T13 re-measured on the flashed firmware (2026-10-21 17:43, firmware 0.3.0-t16e)
| Step | Time |
|---|---|
| Press until the hub tells the unit | 1.68 s (0.76 s the time before; it varies with the browser to hub round trip) |
| Unit told until its first reading | 1.24 s |
| Reading until the dashboard channel | 0.17 s |
| **Press until the first value** | **3.09 s** (2.25 s before; target 2 to 3 s) |
| **Gap between updates** | **average 2.14 s, longest 2.95 s** (was 4.91 s on 0.2.9; 10 updates in 21 s) |
The 2-second Go Live reads of the new firmware work: updates now come about every 2 s while somebody watches. The start is 2 to 3 s, borderline on a slow press. Whether it can go to about 1 s per update depends on reading the inverter every second, which the Deye might not answer; not tried.

## Board day, first session (2026-10-21 16:25 to 17:55)
**Done and verified on the real board**
- Flashed 0.3.0-t16e (settings backed up first). Self-test 47 of 47 including the grant checks.
- **Memory problem found and fixed.** With Bluetooth on and the hub link up, free internal RAM was 17 KB (largest block 7.7 KB) and had dipped to 100 bytes during the secure handshake; with a phone connected the page showed 13 KB. Fix: `heap_caps_malloc_extmem_enable(128)` (allocations of 128 bytes or more go to the 8 MB external RAM). Now 30 to 31 KB free with or without a phone, lowest ever 26 KB, one MQTT connect and no reconnects over 10+ minutes; a phone connected for 5 minutes kept 30 KB free and the hub saw no heartbeat gap.
- **Setup page against the real unit as a customer:** the radar found the unit, the hub issued a view-and-Wi-Fi grant (logged as Bluetooth access), the unit accepted it, Overview, Status, Network, Live readings, Device name and Activity log worked, and Register map, Setup, Push interval, Key and Live logs were locked. Bugs found and fixed: "Set up: Not yet" (the plain Bluetooth record now says `claimed`), the footer scrolling out of view (fixed-height console), and a localhost page being blocked by the hub (CORS allows only https://setup.waytaraenergy.com; use a normal, not Incognito, Chrome window).
- **Go Live rhythm:** 2.14 s average between updates (4.91 s on the old firmware). See the T13 records.
- **T7 inverter cable pull:** last good read 17:48:03, device unreachable 17:48:58, "stopped reporting" and one offline email 17:51:02 (the 2-minute rule), recovered 17:52:32 ("reporting again"), one back-online email queued for after the 10-minute gap; the offline email arrived. Readings matched the inverter display and Status showed the inverter answering.
- Soak restarted on the final firmware at 17:37 IST (ends about 2026-10-24 17:40).
**Still open from the board checklist**
- Service and administrator levels over Bluetooth (needs an admin or an assigned employee account): Live logs, Register map, Push interval, Key, Setup, and the unit refusing what a level does not allow; employee and installer sign-ins (T24).
- Key change on the board and its failure path (T11 firmware).
- The 5-minute idle disconnect (T14).
- Wi-Fi off and on for 3 minutes with the email timeline (T7), left for last by the user. The first attempt at about 17:55 never showed in the hub (status online continuously since 17:52:26), so it was too short or on another network.
- Verify the back-online email (outbox 61) was sent once, at about 18:02.
- Soak report on 2026-10-24 (T25), then documentation (T26).
