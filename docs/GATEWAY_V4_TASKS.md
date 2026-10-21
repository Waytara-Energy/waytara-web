# Gateway v4: what is still to do (pending list, in detail)

Written 2026-10-21 evening, after the first session with the board. It has two parts:

* **Part A: finish Gateway v3.** The tests and clean-up that are still open (everything from `GATEWAY_V3_TASKS.md` that is not ticked), each with what it is for, what is needed, how to do it, and when it counts as passed.
* **Part B: Gateway v4 proper.** The work the user parked on purpose until the solar path was verified (EV charger, the 28 unverified inverter settings, keys and hosting housekeeping, hardening).

Status marks: `[ ]` to do, `[~]` started, `[x]` done and verified. Every task has an **owner** (who must be there), a **board** flag (needs the office board at hand) and a **pass** line (the evidence that closes it). When a task is done, write what was found in the records at the bottom of `GATEWAY_V3_TASKS.md` and tick it here.

## Where things stand (2026-10-21, about 18:30 IST)

* Firmware on the office board: `waytara-gw-0.3.0-t16e` (branch `feat/gateway-fw`, pushed). Linked to the Deye 8 kW inverter `b4c30eb8-fba4-4487-aa7a-3c1b089e36e2` (hardware id `2884855505D0`), Wi-Fi "Waytara Office".
* Hub (`https://hub.waytaraenergy.com`) runs backend commit `1314580` or later. Dashboard and admin app are deployed from `main`. Setup page: `https://setup.waytaraenergy.com` (repository `ESP32-S3-GUI`).
* The 72 hour soak on the final firmware started **2026-10-21 17:37 IST** and runs until about **2026-10-24 17:40 IST**. First report at 18:24: 960 readings in 0.9 h, one gap over 2 minutes (the planned cable pull, 17:48 to 17:52).
* Verified on the board: the self-test (47 of 47), memory with Bluetooth and the hub link running (30 KB free, lowest ever 26 KB), the radar finding the unit, customer and admin grants, the status, live readings, saved networks and the other pages, Go Live (2.14 s between updates), the inverter cable pull with one offline and one back-online email.

---

# Part A: finish Gateway v3

## A1. Bluetooth idle disconnect (T14)  `[ ]`

* **Why:** the unit allows one phone at a time, so a phone left connected would lock everybody else out. The unit must let go of a phone that is quiet for 5 minutes (`BLE_IDLE_MS`), and of one that has not agreed the encrypted link within 30 seconds (`BLE_HANDSHAKE_MS`).
* **Owner:** the user. **Board:** yes (Bluetooth range).
* **Complication:** the setup page sends a `ping` every 60 seconds to keep a session alive, so a page that is open and active never goes idle. A background tab may be throttled by the browser and then really go quiet, but this is not guaranteed.
* **How:** connect on `https://setup.waytaraenergy.com` (normal Chrome window), open Status, note the time, switch to another tab for 6 minutes. Come back and look at the Units page and the radar. If the page still says connected after 6 minutes, the browser kept the ping alive: repeat with the ping paused (a one-line change, or close the page's tab and keep Chrome's Bluetooth connection, which ends the link at once and proves nothing about idle).
* **Pass:** the unit disconnects by itself between 5 and about 6 minutes after the last request, the page shows "The Bluetooth connection ended", and the hub link and Wi-Fi stay up (heartbeat age stays under 20 s on the hub side).
* **Second part (optional):** connect a second phone while the first is connected; the second must be refused or wait, never evict the first.

## A2. Key change on the board (T11, firmware side)  `[ ]`

* **Why:** a key must be replaceable without cutting the unit off. The hub makes a new key, sends it sealed with the old one, the unit keeps it aside, confirms, switches without a restart, and only then is the old key cut. The firmware part has been compiled but never run on the board.
* **Owner:** the user (admin login) with me watching. **Board:** yes, online unit.
* **Risk:** the highest of the pending tests, because a failed change could leave the unit with a key the hub does not know. The design protects against that (both keys are valid side by side, the unit reverts after 90 s without a working link, the database cancels the change after 10 minutes), but do it when nobody depends on the unit and the settings backup exists: `D:\Manoj-Waytara\backups\esp32-office-settings-before-t16-20261021.bin` (contains secrets, never commit).
* **How, success path:** admin app, **Device keys** page, the unit's row, **Rotate key**. Watch the page go through "sent", then "staged", then "The key was changed". I watch the hub side: `key_rotations` (state sent, staged, done), the activity log ("The key was replaced"), and the unit's heartbeat (it must not go offline for more than a few seconds). Afterwards check the unit still sends readings and that the old key is revoked.
* **How, failure path:** start another change and, within the first 20 seconds, switch the board's Wi-Fi network off for about 3 minutes (shared with A3). The unit must stay on its old key, the change must be cancelled by the database after 10 minutes (state `cancelled`), and after the Wi-Fi returns the unit must reconnect with the old key and keep working. Nothing may be locked.
* **Pass:** success path ends with `done` and readings still flowing; failure path ends with `cancelled` and the unit on its old key. Record the board's log lines ("kept aside", "switching", "the new key is in use").
* **Rollback if something goes wrong:** the hub keeps both keys valid during a change. If the unit ends up unreachable, claim it again from the setup page (Setup, needs the BOOT button) or restore the settings backup with esptool.

## A3. Wi-Fi off and on, with the email timeline (T7)  `[~]`

* **Done already:** the inverter cable pull (offline after 55 s, "stopped reporting" and one offline email after 2 min 4 s, recovery, one back-online email after the 10-minute gap) and the hub redeploy (no false alert or email).
* **Left:** the same for the board's Wi-Fi. A first attempt around 17:55 never showed in the hub (the status stayed online since 17:52:26), so it was too short or on another network.
* **Owner:** the user. **Board:** yes.
* **How:** tell me the time, switch off the network the board uses ("Waytara Office" first, then the board falls back to "DESKTOP-R7S5AB3 3669" and then the iPhone hotspot if they are in range: switch those off too, or move the board out of range of them) for a full **3 minutes**, switch it on and tell me the time.
* **Expected:** the hub marks the unit offline 30 s after the last heartbeat; after 2 more minutes one offline email (the customer's inbox); when it returns, "reporting again" in the activity log and one back-online email, but never earlier than 10 minutes after the previous device email. No email while the hub itself is down or just started.
* **Pass:** exactly one offline and one back-online email, the timestamps match the rules, the unit rejoins by itself, readings resume, and the frame queue empties (Status page: waiting readings back to 0, no readings dropped).

## A4. Employee and installer sign-ins (T24)  `[~]`

* **Done:** customer (level "view and Wi-Fi") and admin (level "administrator", "Arun" at 17:46) on the real board; all four roles in the database test `32_four_roles` (22 of 22).
* **Left:** a real sign-in as an **employee** and as an **installer** (site engineer), each assigned to the Waytara Office site. Both should get the **service** level (3): Live logs, Register map, Push interval, Key, restart; but not Setup and not the factory reset.
* **Owner:** the user (needs the two accounts and the assignments, with or without an end date). **Board:** yes.
* **Also try:** an employee whose assignment has **ended** (set the end date in the past): the radar may still find the unit, but the grant must be refused ("You do not have access") and the unit must show nothing.
* **Pass:** each role reaches the pages listed above and no others; the grant is logged at level `service`; an ended assignment is refused.
* **Acceptable shortcut:** the user may decide that the service level, already exercised by the admin pages, is enough for employee and installer, because both go through the same grant level 3 code. Say so and I close it with that note.

## A5. The 72 hour soak (T25)  `[~]`

* **Why:** to prove the final firmware keeps sending for three days: no unexplained gaps, no restarts, the memory not shrinking, no queue growing.
* **Started:** 2026-10-21 17:37 IST. **Ends:** about 2026-10-24 17:40 IST. **Owner:** me, with the user keeping the board powered, on Wi-Fi and wired to the inverter, and not flashing it again. Opening the board's serial port from a PC reboots it: do not do it during the soak.
* **How to read it:** from `D:\Manoj-Waytara\waytara backend server`:
  `node --env-file=.env.render node_modules/tsx/dist/cli.mjs scripts/soak-report.ts "2026-10-21T17:37:00+05:30"` (read only; `.env.render` has the R2 settings and is not committed). Also read the heartbeat record for restarts: `waytara.gateway_devices.last_boot_at` should stay at **2026-10-21 17:36:44 IST** (the boot when the soak began) and not move, and the unit's "start number" on the Status page should not rise.
* **Pass:** no gap over 2 minutes apart from the planned ones (the cable pull 17:48 to 17:52 and the Wi-Fi test, if done during the soak), about one reading per 5 seconds, `last_boot_at` unchanged, free memory on the Status page not trending toward 0 (it was 30 KB), no device emails other than the planned tests. If a planned test is done during the soak, note it so it is not read as a fault.
* **After:** tick T25, then write the verdict into the records.

## A6. Small checks, a minute each  `[ ]`

These were not exercised on the real board and are worth one pass each:

1. **Push interval Save.** Setup page, Push interval: 15 to 10 minutes, Save, then back to 15. The page must say "The push interval is now 10 minutes", the hub must show `upload_interval_s` 600 then 900 (`waytara.gateway_equipment_settings`), and the activity log must hold two "push interval changed" entries under the user's name. (After the admin pass the value was still 900 with no entry, so the Save is not evidenced yet.)
2. **Join and forget a network.** Setup page, Network: join a spare network (a phone hotspot, for example), see "Joined ... in x s", then **Forget** it; the saved list and the activity log ("Wi-Fi network ... was added", "... was removed", never the password) must match. Make sure "Waytara Office" is the first network again afterwards.
3. **Restart.** Setup page, Overview, Restart the unit (service level): the unit restarts, the page returns to the radar, the unit rejoins the hub within about 30 s, and the activity log shows "The unit was restarted from the setup page". Note this makes the soak show a restart: record it as planned.

## A7. Housekeeping that should not wait  `[ ]`

* **Change the admin password** (`hello@waytaraenergy.com`): the login was written in a chat message on 2026-10-21 and is in that conversation's record.
* An older charger key was pasted in chat earlier; it is replaced as part of B1 (new key before the charger goes live).
* `D:\Manoj-Waytara\esp32 scripts\m-supabase_register_push` has uncommitted changes (a README edit and a new `HOW_IT_WORKS.md`) that are not part of this work and were left alone; decide what to do with them separately.

## A8. Documentation (T26)  `[ ]`

Postponed by the user until the flow is verified. When the board tests above are done, write and update:

* `docs/GATEWAY_RUNBOOK.md`: how the pieces connect (inverter, board, MQTT over wss, the Aedes broker in the hub, Cloudflare R2 for cadence files, Supabase for the live values and rollups, the apps); the one 10-second heartbeat (`fleet_tick`), the offline rules and the email rules; Go Live (wake-up, timing table); the key change; the push interval; the soak report; the restart and flashing notes (port held by the Arduino IDE, `--no-stub`, backup location).
* `docs/INSTALLER_GUIDE.md`: the setup page for installers: sign in, the radar and "Add a unit" (once per unit per browser, normal Chrome, https only), the levels, setting up a new unit with the BOOT button, Wi-Fi, checks, claim; what to do when something is wrong (the messages and their causes: localhost blocked, Incognito, iPhone not supported).
* `docs/OPERATIONS.md`: Render deploys are manual after a push; the Supabase jobs (`fleet-tick`), where emails come from, what a person should check when a device is offline, how to read the activity log and the Go Live timing, the soak report.
* `README` of the firmware and of the setup page: the Bluetooth services and levels, the memory plan (`heap_caps_malloc_extmem_enable`), the console commands.
* A short "lessons" section: the memory squeeze found on the board, Bluetooth and TLS sharing a small internal RAM; the one Go Live request per unit (open tabs keep a session alive); the CORS rule (only the deployed page's address may call the hub).

## A9. The three failure causes, end to end (power, network, RS485)  `[~]`

Asked for by the user on 2026-10-21 evening: the board can lose **power**, its **network** or the **RS485 line** to the inverter; each must show correctly on the dashboard (customer and staff), in the activity log and in the e-mails, the RS485 check must live in the heartbeat itself, a status must change only when it really differs from the previous one, and the live updates on the dashboard must come only from Supabase, never from the browser's own judgement.

**What exists and was checked in the code (2026-10-21):**

* **RS485 in the heartbeat.** The board's heartbeat carries `inverter_online` (an answer from the inverter in the last 30 s), the age of the last good read and the success rate. The hub writes it to `equipment_heartbeat.device_online`; three check-ins in a row with the inverter silent make the server verdict **`device_unreachable`** (measured 55 s after the cable was pulled).
* **Power or network lost.** The unit stops checking in; after 30 s without a heartbeat the server verdict is **`offline`**. The server cannot tell power from network while it lasts. It can afterwards: the back-online record now says whether the unit **restarted** (`gateway_devices.last_boot_at` moved: power was lost) or stayed on (the connection was the problem).
* **Only on a change.** The verdict trigger writes `status` and `status_since` only when the new verdict differs from the old one, and broadcasts only that change on the device's live channel (Supabase realtime). The alert step compares what the alert recorded with what is true now and acts only on a difference.

**Changed on 2026-10-21 (code, tests and the migration are done; the migration is live):**

* **The dashboard no longer judges silence.** `useDeviceState` had a 15-second browser clock and a rule that turned a healthy device "offline" when nothing arrived on the live channel for more than 30 s by that clock. Because the unit's values reach the dashboard only every 30 s, and only when they changed, a device with steady values (night, no sun) made the toast "Offline" or "Connection lost" appear in the middle of the page while the server still said online. The browser now follows the server's verdict only (the page's first read, then the live change messages, then a re-read after a hidden tab or a dropped channel). A timer survives only for a device the server has no verdict for. The toast also names the cause: "The monitoring unit has stopped checking in: power or internet may be down." or "The monitoring unit is online but the inverter is not answering it."
* **Cause-aware alerts** (migration `20261022010000_cause_aware_alerts.sql`, test `34_cause_aware_alerts`, 14 assertions): the alert text, the activity log and the e-mail say which of the two causes it is (the RS485 text now names the cable); if the cause changes while the alert is open and the new cause holds for 2 minutes, the alert text is updated, the activity log records it, an unsent first e-mail is corrected in place, and a customer who was already told gets one follow-up; the back-online record carries `was_status` and `restarted`.
* **E-mails:** the subject, the section title and the lead sentence follow the cause ("... is not answering its monitoring unit", "Inverter not answering", "Offline"); the back-online line adds "The monitoring unit restarted, so power was probably lost.", "The monitoring unit stayed on, so the Wi-Fi or internet connection was the problem." or "The inverter is answering the monitoring unit again."

**To verify at the board (owner: the user; board: yes). Tell me the time of each action:**

1. **Browser fix.** Open the dashboard on the Deye with the board online and the values steady (night is ideal) and leave it for 10 minutes. No "Offline" or "Connection lost" toast may appear at any time. Then do step 2 and confirm the toast appears once, with the right sentence, and goes away when the cause is gone.
2. **RS485:** unplug the RS485 cable for 3 minutes. Expect: status "Connection lost" on the dashboard (amber) within about a minute, the toast with the inverter sentence, one e-mail at about 2 minutes ("... is not answering its monitoring unit", the inverter section), the activity log "the monitoring unit is online but the inverter is not answering it". Plug it back: "reporting again" and, after the 10-minute gap, one back-online e-mail ending "The inverter is answering the monitoring unit again."
3. **Network:** switch the Waytara Office router off for 3 minutes (and turn off any phone hotspot the board knows). Expect: "Offline" within 30 s, the offline e-mail at 2 minutes ("Offline"), then on return a back-online e-mail ending "The monitoring unit stayed on, so the Wi-Fi or internet connection was the problem."
4. **Power:** unplug the board's power for 3 minutes, plug it back. Expect the same as step 3 until it returns; the back-online e-mail must end "The monitoring unit restarted, so power was probably lost."
5. **Cause change** (optional): pull the RS485 cable, wait 3 minutes, then also pull the power for 3 minutes. Expect the alert text to change, one follow-up e-mail (or a corrected first one if it had not gone yet), never two e-mails within 10 minutes.
* **Pass:** each step's dashboard state, toast text, activity log line and e-mail match; never more than one device e-mail per 10 minutes; no toast while the device is online; the status on the dashboard changes only at the moments the server records a change (`equipment_heartbeat.status_since`).

---

# Part B: Gateway v4 (parked until solar was verified)

Start these only when the user says so; they were parked on purpose.

## B1. EV charger  `[ ]`

* **State:** the Plugzmart 7.4 kW AC charger is in site ECR Villa (moved back there). It speaks OCPP over plain `ws://` only (its app has a single URL field), so it cannot use the hub's `wss` address. The hub has a plain `ws://` relay (code in `relay/`, with a Dockerfile and `fly.toml`) that was built and tested but is not in service. The charger was removed from the office, the backend and the frontend for now.
* **To do:**
  1. A host that is always on for the relay: Fly.io (planned) or later the small VPS in India (see B4), at **`ocpp.waytaraenergy.com`**; point DNS at it.
  2. A **new charger key** (the old one was pasted in chat and is treated as exposed); set it in the charger's URL path `ws://ocpp.waytaraenergy.com/ocpp/<secret>/<charger name>`.
  3. Put the charger back in the frontend and backend for the right site; check the hub's registry matches the charger's name (the exact label bug was fixed earlier with a cleaning step).
  4. An **OCPP settings page** (in the admin app, and what the customer may see).
  5. A **test charge** with a real car or a load, and the **charging sessions page** (start, stop, energy, cost).
* **Pass:** the charger connects through the relay and shows online, a test charge produces a session with correct energy, the sessions page lists it, the key is new and not in any chat.
* **Open decision:** relay host (Fly.io now or wait for the VPS).

## B2. Verify the 28 unverified inverter settings  `[ ]`

* **State:** only the slot-3 grid-charge setting was verified end to end. The Deye wants function code 16 (write multiple registers) and applies a write 3 to 19 seconds late, which the unit already allows for (it checks the register for up to about 30 seconds). 62 writable registers are in the map; the codec round-trip tests cover all 63 write metrics, but 28 settings have never been written to the real inverter and confirmed.
* **To do:** for each, write a safe value, read it back from the inverter, confirm the dashboard shows the change as confirmed, then put the original value back. The six time-of-use start times (HHMM format) are new and unverified. The inverter clock (three packed registers) stays unwritable.
* **Owner:** the user decides the order and which ones are safe to change on the office inverter; I run it. **Board:** yes, with the inverter.
* **Pass:** each setting is either marked verified in the catalogue (with the date) or marked as not writable with the reason. No setting is left half-changed.

## B3. Move the Ola Maps key to a company account  `[ ]`

* The `OLA_MAPS_API_KEY` is on a personal account and was exposed. When the user asks: create the key under a company account, rotate the exposed one, update the environment variable in Vercel (dashboard), redeploy, check the Devices page map and weather still load.

## B4. Hosting: Render plan and the later VPS  `[ ]`

* **Now:** Render free plan plus the Supabase `fleet-tick` job as the keep-awake (every 10 s). Fine for the office board, not for customers.
* **Before real customers:** Render Starter (about 7 USD a month) so the hub never sleeps.
* **Later:** one small paid VPS in India (DigitalOcean Bangalore or AWS Lightsail Mumbai) for the hub, Mosquitto (if the broker moves) and the charger's plain `ws://` entry point (replaces the Fly relay). Boards connect to `hub.waytaraenergy.com`, so moving hosts is a DNS change with no reflash.
* **Decisions kept:** Aedes stays as the broker (EMQX Cloud rejected: no confirmed per-board user and ACL API on Serverless); Oracle Always Free rejected as the only production host (idle reclamation, account risk); Google Cloud not preferred (free tier is US only). The planned signed "change broker" command is not built.

## B5. Hardening  `[ ]`

Not started. Candidates, to be decided one by one:

* Secure boot and flash encryption on the board (a lost board then cannot be read or cloned); needs a plan for the factory process and a recovery path before enabling, because they cannot be undone.
* Rollback protection for the key and for firmware images.
* Alerts for the things that should never happen: a board restarting repeatedly, free memory falling, the frame queue not emptying, a failed key change, a burst of failed grant requests.
* A rate limit and lock for the Bluetooth `auth` command beyond the current three bad grants per connection.
* A flash spill for the board's frame buffer (readings are lost today if the board restarts with unacknowledged frames; the buffer lives in PSRAM only).

## B6. Parked features  `[ ]`

* **Signed firmware update** from the setup page (dropped from v3; the firmware version is shown but not changed remotely).
* Bluetooth-always-visible with a fixed test login (replaced by signed grants; nothing left to do unless the model changes).
* More setup page detail the user may want: the "etc" beyond the device name (the site name and address and the device model stay with WayTara).

---

# Quick reference

| What | Where |
|---|---|
| Hub | `https://hub.waytaraenergy.com` (`/healthz` shows the version and uptime; Render deploys are manual) |
| Setup page | `https://setup.waytaraenergy.com` (normal Chrome, https; only this address may call the hub) |
| Task lists | `docs/GATEWAY_V3_TASKS.md` (records), this file (what is left) |
| Board | hardware id `2884855505D0`, flashed with `0.3.0-t16e`, COM4 when on USB (opening the port reboots it) |
| Settings backup | `D:\Manoj-Waytara\backups\esp32-office-settings-before-t16-20261021.bin` (secret) |
| Soak report | `scripts/soak-report.ts` in the backend repo |
| Go Live timing | `select * from waytara.equipment_live_timing;` (wait until `select count(*) from waytara.equipment_live_requests where until > now()` is 0 before a new press) |
| Heartbeat and status | `waytara.equipment_heartbeat` (the verdict, the message, the time since), `waytara.device_activity_log` |
| Emails | `waytara.notification_outbox` (`sent_at` null means waiting; one device email per 10 minutes) |
