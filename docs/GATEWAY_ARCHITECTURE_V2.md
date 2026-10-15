# WayTara Gateway Architecture, version 2

Status: **plan for your review, no code written yet.** Date: 2026-10-14. Revision 3 (same day, after your second set of answers): broker is **built into the backend now and Mosquitto on your own server later** (EMQX dropped), setup is authorised by **account sign-in** (no sticker), EV sessions record the **solar / battery / grid split**, EV samples are kept **6 months**, and the key tables now say where each key is **used and fetched**.
Replaces: `docs/GATEWAY_ARCHITECTURE_PLAN.md` (version 1, written before the stack and repos were fixed).
Companion file kept as is: `docs/DEYE_8K_REGISTER_DECODE.md` (every register formula).

How to read this: sections 1 and 2 are the summary and the decisions I need from you. Sections 3 to 15 are the design. Section 16 is the account setup guide. Sections 17 to 22 are security, numbers, tests, roadmap, spikes and the checklist. Appendices at the end.

Labels used: **[verified]** means I read it in a vendor's own documentation on 2026-10-14. **[estimate]** is my arithmetic and must be measured. **[unverified]** means I could not confirm it and it is on the spike list (section 21).

---

## 1. One-page summary

```
                       phone (Android Chrome)                      customer / staff browsers
                              |  Bluetooth (setup only)            (dashboard, admin app, setup GUI)
                              v                                                   |  HTTPS / WSS
 Inverter --RS485--> ESP32-S3 gateway -- sealed MQTT over wss --+                |
 (Deye 8K)           (Waveshare board)                          v                v
 EV charger (OCPP 1.6-J) -- wss (ws only if it must, 13.2) --> waytara-backend (Render)
                                                               built-in MQTT broker now,
                                                               decode, 15-min rollups, commands,
                                                               live relay, OCPP server, key service
                                              +---------------------+----------------------+
                                              v                                            v
                                   Cloudflare R2 (cadence CSV,                    Supabase (system of record,
                                   28 days, rolling)                               15-min and daily data, Realtime)
        later: Eclipse Mosquitto on your own server replaces the built-in broker
```

What changed from what you asked, in one line each (reasons in section 4):

1. Android phones set the board up over **Bluetooth** with our web page on Vercel. iPhones cannot (Safari has no Web Bluetooth), so a hotspot page is a later add-on.
2. **Wi-Fi only.** The board has no Ethernet or SIM. The firmware keeps a network layer so they can be added with extra hardware later.
3. **Broker: built into the backend now, Eclipse Mosquitto on your own server later.** EMQX Serverless was dropped because staying inside its free quota needs a spend limit of 0, which stops the service at the quota, and you did not want a spend limit. HiveMQ no longer gives new accounts a free cluster. The firmware only stores a broker address, so the move to Mosquitto needs no reflash (3.3).
4. The charger link is **wss:// if the charger accepts it**, otherwise plain **ws://**. Its example address uses port 9220, which neither Render nor Cloudflare serves, so a probe test on the real charger picks one of three routes (13.2): direct to Render over wss, Cloudflare in front on port 80, or a small front-door server on 9220. Your own domain (`waytaraenergy.com`, DNS at Vercel) is used for these; no Cloudflare migration is needed for the first route.
5. The ESP **no longer talks to Supabase or Google Sheets at all.** It only talks MQTT. Supabase writes, R2 files, decoding and the 15-minute maths are all in the backend.
6. Go Live goes **through the backend relay** (not straight from browser to broker) until the broker can give each customer their own permission.
7. No ordinary object store can append to a file (R2, Backblaze B2, S3 alike), so cadence data is written as small CSV parts per 5 minutes and joined when a report is opened or downloaded; to you it still looks like one CSV per device. A lifecycle rule deletes day by day, so the window is **rolling 28 days**. R2 stays the default; storage is behind an interface and alternatives are compared in 11.5.
8. The number of PV inputs is **not a question any more**: it comes from the stock record (`technical_specs.mppt_count`, 2 for the SUN-8K) and is cross-checked against register 18 at boot (5.3).

---

## 2. Decisions

### 2.1 Settled (your answers, 2026-10-14)

| # | Decision |
|---|---|
| S1 | Cadence retention is **4 weeks**, rolling. The report picker shows the last 28 days. |
| S2 | Go Live is relayed by the backend. |
| S3 | The **backend builds the 15-minute summaries from raw readings**. The ESP no longer does the bucket maths. |
| S4 | Render **free** with an external ping now; **paid before real customers**. |
| S5 | **Wi-Fi only.** No Ethernet, no cellular. |
| S6 | Setup is **Android over Bluetooth** first. |
| S7 | Firmware stays **Arduino-ESP32** for now (reuse the working Modbus and register code). |
| S8 | Installers are assigned to sites **by the admin**, several per site. Access follows the assignment (section 6). |
| S9 | **Updated 2026-10-14:** you want `wss://`; the Plugzmart charger's own example address is `ws://random.domain.com:9220/WT_PZ_7k_1` (port 9220, path = charger id), with one address field, no user/password and no TLS options. So the scheme and port are decided by a **probe test** on the real charger (13.2 decision tree, spike 6): wss on 443 if it works, otherwise plain ws:// through Cloudflare on port 80 or a small front-door server on 9220 (13.6). |
| S14 | **Broker (revised): Eclipse Mosquitto self-hosted when you have a server; until then a broker built into the backend.** EMQX is dropped. See 3.3. |
| S15 | The number of PV inputs comes from **stock/equipment data**, not from a question to you (5.3). |
| S10 | Repos: `git@github.com:Waytara-Energy/waytara-backend.git` and `https://github.com/Waytara-Energy/ESP32-S3-GUI.git`. Firmware lives in the existing `esp32 scripts` repo. |
| S11 | The equipment key and the connection URL are **created by an admin or by an employee assigned to that site**. |
| S12 | Heartbeat is defined for **both the gateway and the EV charger** (section 12). |
| S13 | During a charging session we store **power, current, voltage, meter value and more** at regular points, so the customer can follow the load (section 13.5). |

### 2.2 Decided in your second round of answers (2026-10-14)

| # | Decision |
|---|---|
| S16 | Cadence CSV storage is **Cloudflare R2** (closed). |
| S17 | You own the domain `waytaraenergy.com` (closed); details in S26. |
| S18 | EV session samples are kept **6 months** (closed). |
| S19 | Each EV sample stores the **site load, solar, battery and grid power**, and each session shows where its energy came from: **solar first, then battery, then grid** (rule in 13.5). (closed) |
| S20 | Installers use **Chrome on Android** (closed). |
| S21 | **Setup is authorised by signing in with the account password**: the customer for their own equipment, an installer only when the admin has given them access to that site. **No sticker code.** (8.4, closed) |
| S22 | Charger link: you want **wss://**. Whether the Plugzmart charger supports it is **not publicly documented** (I searched twice and found nothing; 13.2), so a test on the real charger decides. The test service ("probe") is approved. |
| S23 | Meter values are fetched together with the heartbeat during a charging session (12.2). |
| S24 | **Wiring:** the grid and the load are connected to the inverter, and the EV charger is one of the loads on the inverter's load output. So the inverter's load figure includes the car, and the split in 13.5 applies as written (O4 closed). |
| S25 | **Other devices later:** the EV charger is a separate usage summary now, and any other device in the property can get its own usage summary in the same way later (14.5). |
| S26 | **Domain:** `waytaraenergy.com`, registered at GoDaddy, with **DNS hosted by Vercel** (name servers `ns1/ns2.vercel-dns.com`), already serving the website and `admin.` and with email on Microsoft 365. **No migration to Cloudflare is needed** (16.4). |
| S27 | **EV first:** the EV charger draws solar first, then battery, then grid (13.5). Any other device added later shares what is left in proportion to the house mix (14.5). |

### 2.3 Still open (defaults in brackets, so "defaults" is a valid answer)

| # | Question | Why it matters |
|---|---|---|
| **O1** | *Closed (recommended, awaiting your OK): broker for the pilot is Aedes inside the backend; Mosquitto on your own server later. EMQX free (spend limit 0) stays the alternative if the backend moves to an always-on paid instance or you want the broker separate.* | 3.3 |
| **O2** | **The 29 unverified values** (A3.5 now shows, for each, whether it is fetched or written over Modbus, where it is shown, which code names it, and which calculated value uses it). [Show them read-only with a "not yet verified" label; block writes until each is checked on the unit.] | Your `config.h` had `ALLOW_UNVERIFIED_WRITES 1`. |
| **O3** | *Closed (S26): domain facts known.* | |
| **O4** | *Closed (S24): the charger is behind the inverter.* | |
| **O5** | *Closed (S27): EV first; other devices proportional.* | |
| **O6** | **Charger route A, B or C.** | Decided by the probe test, 13.2. |
| **O7** | Polling only the 99 customer-visible inverter rows (110 registers). [Yes.] | Keeps each Modbus pass short. |
| **O8** | Cloudflare R2 sign-up may ask for a payment method (free usage stays free). OK? | 16.3. |

---

## 3. Components, repos and who talks to whom

### 3.1 The five pieces

| Piece | Where it lives | Hosting | What it does |
|---|---|---|---|
| Dashboard, admin and employee apps | `D:\Manoj-Waytara\Projects` (this repo) | Vercel | Customers and staff use these. Changes listed in section 15. |
| Gateway firmware | `D:\Manoj-Waytara\esp32 scripts` (new folder `waytara-gateway-fw`; the old `m-supabase_register_push` stays for reference) | Flashed to the board | Setup over Bluetooth, Wi-Fi, reads the inverter, sends sealed MQTT. |
| Setup GUI | `D:\Manoj-Waytara\ESP32-S3 GUI` (repo `ESP32-S3-GUI`) | Vercel (static) | Runs in the phone's Chrome, talks to the board over Bluetooth. |
| Backend | `D:\Manoj-Waytara\waytara backend server` (repo `waytara-backend`) | Render | Decode, storage writes, Supabase, live relay, commands, OCPP, keys. It is a **client** of the broker. |
| Broker | built into the backend now (Aedes); Eclipse Mosquitto on your own server later | Render now, your server later | Carries sealed MQTT between gateways and the backend. Each board has its own login and may only use its own topics. |
| Data | Supabase (project `yxenvzcfypfqzbpfyuiz`) and Cloudflare R2 (default) | managed | System of record, and 28 days of cadence files. |

### 3.2 Technology choices (backend and GUI)

| Area | Choice | Why |
|---|---|---|
| Backend runtime | Node.js 22 LTS, TypeScript, Fastify | Schema validation, plugin ecosystem (helmet, cors, rate limit, websocket), simple to run on Render. |
| MQTT broker and client | `aedes` (built-in broker, now); `mqtt` (client, used when the broker moves to Mosquitto); automated tests run a local Aedes | The built-in broker's login check calls our key service directly, so a board needs no manual broker user. |
| OCPP | A thin OCPP-J 1.6 layer on `ws` with JSON-schema validation; `ocpp-rpc` is the candidate library **[unverified: check licence, 1.6 schemas and maintenance]** | A charger sends many malformed messages in the field; validate everything. |
| Auth | `jose` verifying Supabase JWTs against the project's JWKS | No shared secret needed. |
| Object storage | `@aws-sdk/client-s3` behind a small `CadenceStore` interface (R2, Backblaze B2 and others speak the S3 API; Supabase Storage has an adapter) | Switching store is a setting. |
| Supabase | `@supabase/supabase-js` as a **limited service user** (not the `service_role` key) | Your rule. |
| Validation, logs, tests | `zod`, `pino`, `vitest` | |
| GUI | Vite + React 19 + TypeScript, static, installable web app | Web Bluetooth needs HTTPS and a user tap; no server rendering needed, so none of the Next.js 16 differences apply. |
| Firmware | Arduino-ESP32 core 3.x with NimBLE-Arduino, ESP-IDF `esp-mqtt`, mbedTLS, ArduinoJson (MessagePack), LittleFS | Exact versions are pinned when development starts. |

### 3.3 The broker: built in now, Mosquitto on your server later (S14)

**Set aside.** HiveMQ: no new free clusters (its quick-start says so, and Starter is listed from $0.34/hour) **[verified]**. EMQX Serverless: free quota of 1 million session minutes and 1 GB traffic a month, but the default spend limit of 0 uses only the free quota, a payment method is needed only above 0, and there is no documented way to create users by API **[verified]**. You declined a spend limit, so it is dropped.

**Stage 1, now: a broker inside the backend (Aedes).**
* Boards connect to `wss://hub.waytaraenergy.com/mqtt` (MQTT over WebSocket on port 443). Render exposes only ports 80 and 443 for a public service, so this is the only way to reach a broker there **[verified, secondary]**.
* **Per-board login, no manual work:** the broker's login hook accepts user name = equipment id and password = the equipment key, checked against `equipment_keys`. Its topic hook lets a board publish and subscribe only below `wt/v1/<its equipment id>/`. A board can never read another board's topics, which is stronger than the shared logins of the managed options. Payloads are still sealed (10.2).
* **Cost:** nothing beyond Render. One always-on free service is allowed (750 hours a month), and the backend and the broker are the same service.
* **Staying awake:** while any board is connected, its MQTT keep-alive messages are inbound WebSocket traffic, which Render counts as activity **[verified: Render docs]**. A health-check monitor is still added for the first start.
* **What it does not do:** it keeps no messages for a board or backend that is away. That is covered by design: boards keep their data until acknowledged (10.4), and a command is re-issued from the database when the board reconnects (`gw_pending_writes`).

**Stage 2, when you have a server: Eclipse Mosquitto.**
* A basic server you rent (not priced here) runs Mosquitto with TLS on 8883 (and WebSocket if wanted) and persistence. The same server can also act as the charger front door (13.6, route C).
* **Per-board logins are created automatically:** Mosquitto's dynamic-security plugin lets the backend create a role (topic permissions) and a client (user name and password) by publishing to `$CONTROL/dynamic-security/v1`, and changes apply without a restart **[verified, secondary: mirrors of the Mosquitto source; check the exact command names against the version installed]**.
* The move is a settings change: the broker address, user and password are in the board's protected storage and can be updated with a signed command, so no reflash (10.6, `type: broker`).

**Why not Mosquitto on Render now:** a second always-on service does not fit the free plan, and a static Mosquitto password file cannot follow keys that admins create at any time without the plugin and a server of your own.

**Can the backend use "the Mosquitto library"? Not as a library.** `libmosquitto` is only the *client* library; the Mosquitto broker is a separate program, and I found no supported way to embed it in a Node process **[verified, secondary: Mosquitto mailing list and docs]**. So for stage 1 there are two real options:
* **A. Aedes inside the Node backend (recommended now).** One process, one deployment, the login hook can call our key check directly, light on memory.
* **B. The real Mosquitto program in the same Render container** (a Docker deployment that starts Mosquitto and the Node backend together under a small process manager, with the backend proxying the `/mqtt` WebSocket to Mosquitto). It behaves exactly like the later server. It costs more memory and CPU than Aedes on a 512 MB / 0.1 CPU instance **[verified: Render free spec]**, adds a process manager, and Mosquitto's user and topic list does not survive a restart on Render free (the disk is wiped), so the backend would re-create every board's login from the database at start. Whether the free plan accepts this Docker layout is **[unverified: spike]**.
Both use the same topics, so the boards cannot tell them apart. If you want identical behaviour with the later server, say so and I use B; otherwise A.


---

## 4. What I checked, and what it changed

### 4.1 Bluetooth cannot open a web page
The hotel-style pop-up is a Wi-Fi hotspot feature. Over Bluetooth the phone does not load a page from the device. So the setup page is a normal website (Vercel) that the installer opens in Chrome and uses to talk to the board over Bluetooth (Web Bluetooth). Chrome shows its own device chooser, and the user picks the board. The open Improv Wi-Fi standard uses the same pattern: scan networks, send SSID and password, read device info, and its GATT messages are unencrypted **[verified: Improv protocol notes]**, so we add encryption on top (section 8.4). iPhone Safari has no Web Bluetooth, hence S6.

### 4.2 The board
Waveshare ESP32-S3-RS485-CAN: ESP32-S3, 16 MB flash, **onboard PCF85063 real-time clock with a battery header**, BOOT and RESET buttons, DC 7 to 36 V screw terminal, USB-C, RS485 and CAN, Wi-Fi 2.4 GHz and Bluetooth LE. No Ethernet and no SIM **[verified: Waveshare wiki]**. The wiki does not state the RS485 or CAN pin numbers (it says direction is switched automatically in hardware), so the pins `RX 18, TX 17, EN 21` come from **your tested `config.h`**, which you confirmed works. PSRAM is not stated **[unverified]**, so buffers are sized for internal RAM plus flash.

### 4.3 Storage and R2
Free allowance per month: 10 GB storage, 1 million writes (Class A), 10 million reads (Class B), egress free **[verified: Cloudflare pricing]**. Lifecycle rules delete objects after N days by prefix, "typically within 24 hours" of expiry, up to 1,000 rules **[verified]**. I found no source that confirms or denies appending to an object; I treat R2 as write-whole-object, like S3. Your question "if R2 cannot, what else?": R2 **can** store the CSVs, the only limit is that a file cannot grow in place, which is true of every ordinary object store; the parts approach in 11.5 solves it on any of them. Alternatives are compared in 11.5.

### 4.4 Render free
A free web service spins down after 15 minutes without inbound traffic (HTTP or WebSocket messages); whether outbound-only connections count is **not documented** **[verified]**. It gets 750 free hours a month, enough for exactly one always-on service. Therefore: an external monitor calls `GET /healthz` every 5 minutes (any free uptime monitor), and the gateway's data path survives a sleep because the ESP keeps data until acknowledged (10.4). Render redirects plain `ws://` and `:80` requests to HTTPS and never upgrades them **[verified: Render community reports, secondary]**; this is why section 13.6 exists.

### 4.5 Brokers
HiveMQ and EMQX are set aside (3.3). With the broker built into the backend, a backend restart drops the board connections for a minute or two; the boards reconnect with backoff and resend what was not acknowledged. When the broker moves to its own server, a backend restart no longer touches the boards at all.


---

## 5. The data: which key names, and the cadence versus 15-minute idea

### 5.1 Plain-language recap
* **Cadence data** is every reading as it happens (each register at its own interval: 5, 10, 30, 300 or 3600 seconds). It goes to R2 as CSV for 28 days. Used by Go Live and detailed cadence reports.
* **15-minute data** is a summary of each 15-minute window per value (average, minimum, maximum, last, and energy). It goes to Supabase every upload interval (default 15 minutes) and is kept 8 days in 15-minute form, then as hourly and daily rows forever. Used for charts, daily and monthly totals and savings.
* The ESP only measures and sends raw words. The backend does both jobs.

### 5.2 What the gateway polls (answer to your question 8)
Using `show_for_user = true` for the equipment `b4c30eb8-…` ("Waytara Office"), read on 2026-10-14:

| Group | Count | Meaning |
|---|---|---|
| Customer-visible keys in total | 197 | |
| **Read from the inverter** (they have a register) | **98 keys on 110 registers** | Appendix A3.1. These are the only registers the gateway polls. |
| **Calculated or looked up by the platform** (no register) | **27** | Appendix A3.2. Made from the values above, from site records or from the weather service. |
| **Settings a customer can change** | 63 inverter registers + 3 stored by the platform | Appendix A3.3 |
| Actions | 2 | Download report, contact support |
| Not shown to customers | 277 | 276 of them are inverter registers. They are **not polled** unless an admin enables a "poll for diagnostics" flag (section 14.3). |

Registers in the whole catalogue: 388. Polling only the visible ones is 110, so a full pass is roughly a third of the length **[estimate; Modbus timing is a spike]**.

Cadence of the 98 visible reads: 5 s: 33, 10 s: 13, 30 s: 30, 300 s: 13, 3600 s: 10 (the 3600 s ones are identity values such as serial number and firmware, read at boot and hourly).

### 5.3 Calculated values and what they depend on
All dependencies are already in the polled set. `pv_total_power_w` is described as "PV1 + PV2 + PV3 (registers 186 to 188)". The number of PV inputs is a **fact about the equipment, not a question for you**, and the data already answers it:
* **Stock record** (`equipment_inventory.technical_specs` for the Deye SUN-8K-SG01LP1-EU): `mppt_count: 2`, `max_pv_input_kw: 10.4`, `phase: 1` **[verified: read from the database today]**.
* **The inverter itself**: register 18 (`mppt_count`) last read as 2, and `phase_count` as 1 **[verified]**.
* **The catalogue** has PV1 and PV2 keys only; there is no `pv3_*` key for this equipment.

So the register-map builder (10.5) works like this: take `mppt_count` from the stock record, include `pvN_*` registers only up to that number (for a 3-input model it would add register 188 and the `pv3_*` keys from the template), and the gateway re-reads register 18 at boot. If the register disagrees with the stock record, the gateway reports a "stock record mismatch" event and the admin app shows a warning; the map keeps using the register value. `pv_total_power_w` and `pv_input_share_pct` then use exactly those inputs.

`active_alerts` is built from the warning and fault words (registers 101 to 106) using the fault code table in `equipment_enum`, so those registers stay on a 10-second cadence.

---

## 6. People and permissions

### 6.1 Roles that exist today
`customer`, `employee`, `site_engineer`, `admin` (database enum `user_role`). Today an employee sees a site only through `customer_onboarding.employee_id` (one employee per customer). A `site_engineer` or `admin` passes `is_site_engineer_or_admin()` and sees everything in some tables. That cannot express "this site has three installers".

### 6.2 New: site assignments
New table `waytara.site_staff`: `site_id`, `staff_id` (a profile), `granted_by` (the admin), `granted_at`, **`expires_at` (optional, for temporary access)**, `removed_at`. An admin adds or removes rows (admin app, site page: a multi-select of employees and site engineers) and this is the "permission" an installer needs. Unique per active (site, staff).

New function `waytara.can_access_site(site_id)` returns true when the caller is:
1. an **admin**; or
2. the **customer** who owns the site; or
3. a **staff member with an active `site_staff` row** for that site; or
4. (legacy, kept until migrated) the employee on the customer's `customer_onboarding` row.

Every site-scoped table gets its read policy rewritten to call it: `sites`, `equipment`, `equipment_latest`, `equipment_open_bucket`, `equipment_rollup_*`, `equipment_configs`, `equipment_heartbeat`, `equipment_metrics`, `ev_sessions`, `ev_session_samples`, and the new key tables. Policies keep the `(select auth.uid())` form used elsewhere for speed.

### 6.3 What each role can do

| Action | Customer | Assigned employee / site engineer | Admin |
|---|---|---|---|
| See own or assigned site data and status | yes (own) | yes (assigned sites only) | all |
| See hidden (non-customer) values | no | yes, assigned sites | all |
| Change settings | those marked customer-writable and verified | customer + installer level; engineer level for grid-code settings (`site_engineer` only) | all |
| **Create, rotate or revoke an equipment key and connection URL** | no | **yes, on assigned sites** | all |
| Onboard a gateway (setup GUI, 8.4) | yes, own site, after signing in | yes, assigned sites with an active permission | all |
| Assign staff to sites | no | no | yes |
| See key values | never (a key is shown once, at creation) | once | once |

---

## 7. Equipment keys and connection URLs (S11)

Every inverter gateway and every charger has its own **key**: a random 256-bit secret. The key is the only credential for that equipment.

### 7.1 Creating a key (screen in the admin app and in the GUI)
1. A person with permission (6.3) opens the equipment and presses **Create key**.
2. The backend checks `can_access_site`, creates the key, stores it **encrypted** (AES-256-GCM with a master key that exists only in Render settings), stores a short fingerprint for display, and returns the key **once**.
3. The screen shows, with copy buttons:
   * for a **gateway**: the key (the setup GUI passes it to the board over Bluetooth; nobody types it) and the broker address;
   * for a **charger**: the **connection address** to type into the charger app, shaped by the route chosen in 13.2: branch A `wss://ocpp.waytara.com/k7q3x9m2p8r4t6vw5n2c8d3f/WT_PZ_7k_1` (24-character random secret, then the charger id); branches B and C `ws://k7q3x9m2p8r4t6vw.<domain>:9220/WT_PZ_7k_1` (random host name, then the charger id). Copy button for the full address.
4. The event is written to `equipment_key_events` (who, when, from which address, what).

During normal onboarding (8.4) the key is created by the claim step and goes straight to the board; **the customer or installer never sees it**. The screen above is the manual path for staff (a charger, a replaced board, a rotation).

Rotate = create a new key (old one stops working after a grace period you choose, default 0 minutes). Revoke = the key stops working and any live connection using it is closed within seconds.

### 7.2 Why the key is stored encrypted, not hashed
The gateway proves possession by signing and encrypting messages (10.2), which needs the secret itself on the server. A hash cannot do that. The cost is that the master key in Render settings is a high-value secret; the later hardening step (phase 6) is a per-device key pair so the server holds only public keys.

---

## 8. Gateway firmware

### 8.1 Folder and structure
New folder `esp32 scripts\waytara-gateway-fw`, an Arduino sketch split into modules (each file small and testable): `net_wifi`, `ble_setup`, `store` (protected settings), `clock`, `checks`, `modbus_engine`, `plan` (register map), `frames` (build readings), `buffer` (ring buffer and flash spill), `seal` (encryption and signing), `mqtt_link`, `commands` (writes with read-back), `heartbeat`, `ota`, `log`. FreeRTOS tasks: network, MQTT, Modbus, Bluetooth, supervisor (watchdog and health).

### 8.2 `config.h` after the change
Only things that do not change per device stay compile-time: RS485 pins `RX 18, TX 17, EN 21`, Modbus `9600 8N1`, slave `1`, timing defaults, feature switches. These **disappear** from the file: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DEVICE_TOKEN`, `CADENCE_SCRIPT_URL`, `DEFAULT_WIFI_*`, `EQUIPMENT_ID`. They become per-device settings written during Bluetooth setup into encrypted flash (NVS with flash encryption in production). `ALLOW_UNVERIFIED_WRITES` becomes a server-side per-equipment flag, default off (O2). `TLS_VERIFY` is always on in production builds.

### 8.3 Boot sequence (each step is reported in the GUI and in the heartbeat)
1. Self-check: watchdog, storage, reset reason, firmware version, read the RTC.
2. Load settings. If there is no Wi-Fi saved, or the BOOT button is held 3 seconds, or the setup window is open: start Bluetooth setup (8.4).
3. Connect to the best saved Wi-Fi (up to 3 saved, with priority; exponential backoff with jitter).
4. **Connection checks**, in this order, each with a result and a time: Wi-Fi associated; IP and DNS; **time sync** (SNTP, then write the RTC; if offline, use the RTC); TLS to the broker (certificate verified against the public certificate authorities stored on the board; no unverified TLS in production); broker login; backend acknowledgement (a signed hello answered with the register map version); Modbus test read of register 0 from slave 1.
5. Download the **register map** (10.5) if the broker's version differs from the stored one.
6. Start polling, buffering and sending; start the heartbeat.

Any step can fail without stopping the rest: with no internet the unit still reads the inverter and buffers; with the inverter silent it still sends heartbeats saying so.

### 8.4 Bluetooth setup (S6)
**When is it on?** Only when unprovisioned, or after a 3-second BOOT hold, or after 10 minutes with no network, or when an authorised dashboard command opens a 10-minute window. Not always.

**Protocol.** One custom GATT service with characteristics for: info (read), scan list (notify), command (write), response (notify), status (notify). It follows the Improv message layout where it fits (scan, submit credentials, device info) and adds: set broker, set equipment id and key, forget network, list saved networks, run checks, speed test, factory reset, reboot. Frames are chunked to the negotiated MTU.

**Security: authorised by the account sign-in, no sticker code (S21).**
1. The person opens the setup GUI and **signs in with their WayTara account password**. A customer sees only their own equipment. An installer sees only sites where the admin has given them an active permission (`site_staff`, 6.2); when the permission expires or is removed, they lose access.
2. They pick the equipment, then **hold the BOOT button for 3 seconds** on the board. That opens setup for 10 minutes, accepts one connection, and the board advertises as `WayTara-` plus the last six characters of its hardware address. Needing a hand on the board is the physical proof.
3. Chrome connects over Bluetooth. The link is encrypted (ephemeral ECDH P-256 key exchange, then AES-256-GCM), so the Wi-Fi password and the claim ticket are not readable by someone nearby.
4. The GUI asks the backend for a **claim ticket**: single use, valid 15 minutes, bound to that equipment and to the board's hardware address (read over Bluetooth). The backend refuses unless step 1 permits it.
5. The GUI sends the Wi-Fi details and the ticket to the board. The board joins Wi-Fi and calls the backend over TLS with the ticket. The backend burns the ticket, creates the equipment key (7.1), and returns it **encrypted to the board's own key** from step 3.
6. Re-claiming a board that already has a key revokes the old key. Three wrong attempts lock setup for 60 seconds.
Residual risk, stated plainly: during the 10-minute window someone standing next to the board could try to connect first. The BOOT-button requirement, the single connection and the server-side ticket (nothing useful is granted without a valid sign-in) contain it. Wi-Fi passwords go phone to board only and are never sent to our servers. **[spike: compare with Espressif's own provisioning (SRP6a, "security 2") before building our own]**

**Screens in the GUI** (section 9): sign in, pick the equipment, press BOOT on the board, connect, Wi-Fi list with signal bars (2.4 GHz only; a note if the user's network is 5 GHz only), password, optional static IP and hidden network, **Check connection** with the step list from 8.3, **speed test**, saved networks with Forget, and the equipment claim step.

**Speed test.** Reports signal strength (RSSI), channel, round-trip time to the backend and broker, and download and upload throughput measured with a short transfer against a `/v1/speedtest` endpoint. The link's negotiated rate alone is not shown as "speed" because it is misleading.

**Network type selector.** The GUI shows Wi-Fi only; Ethernet and cellular appear greyed with "not on this board". The firmware network layer is an interface (`NetworkLink`), so a future Ethernet or modem module can be added without touching MQTT or Modbus code.

### 8.5 Modbus engine
* Reads only what the register map lists. Adjacent registers are merged into one request when the gap is small (the Deye accepts large reads **[unverified: spike finds the maximum]**).
* A due-time scheduler per cadence class (5, 10, 30, 300, 3600 s) with the fast class first. Reads never overlap a write.
* Each request has a timeout, three retries, CRC check, and exception-code handling. A register that fails three passes in a row is flagged in the next frame, not silently zero.
* The inverter value is sent **raw** (16-bit words as read). No scaling on the ESP.
* Time for one pass at 9600 baud **[estimate]**: about 2.3 ms per register plus 60 to 100 ms per request, so the fast group (33 registers in about 6 requests) takes roughly half a second, well inside 5 seconds.

### 8.6 Frames, buffer and acknowledgement
Each read produces a **frame**: device time (milliseconds since 1970, or since boot if the clock is not valid yet, corrected later), a boot number, a sequence number, the register map version, and for each request: first register, words. The ESP groups frames into **batches** every 30 seconds in normal mode (to save bandwidth) and sends every frame immediately in Go Live. Batches are kept in a ring buffer in RAM and spill to flash (LittleFS, about 1 to 2 MB) when more than 10 minutes pile up. A batch is deleted **only when the backend acknowledges it** (10.4). Capacity in flash: about 26 hours **[estimate]**.

### 8.7 Writes (settings) with confirmation
A signed command arrives (10.6). The ESP checks the signature, the expiry (commands older than their limit are ignored), the register is on the writable list in the map, and the value is inside the minimum and maximum. It pauses polling, writes, **reads the register back**, compares, resumes, and sends an acknowledgement with `ok`, `readback` or `error`. The dashboard shows Applying, Confirmed or Failed. Unverified keys are refused unless the server's per-equipment flag allows them (O2).

### 8.8 Updates and safety
* OTA from a signed image over HTTPS with rollback if the new image does not report healthy within 3 minutes. (phase 6)
* Task watchdog on every task; reboot reason is reported.
* Production build: flash encryption and secure boot are turned on at the factory step. They are **irreversible**, so this is a deliberate phase 6 action with a spare board, not something done during development.

---

## 9. Setup GUI (`ESP32-S3-GUI`)

* Static web app on Vercel, HTTPS, installable to the phone's home screen.
* **Everyone signs in** with their WayTara account (the same Supabase accounts as the dashboard and admin app; Supabase Auth in the browser): customers for their own equipment, installers for sites where they hold an active permission. The GUI calls the backend with that sign-in; the backend decides what is allowed (6.3).
* Pages: **Sign in**, **Pick the site and equipment** (only assigned sites), **Connect to the board**, **Wi-Fi**, **Checks and speed**, **Claim** (creates or rotates the key through the backend and sends it to the board over the encrypted Bluetooth link), **Saved networks / Forget**, **Done** (shows live status from the backend).
* The key is held in memory only for the moment it is sent, never written to browser storage.
* If Web Bluetooth is not available, the page says so and shows the supported browsers.

---

## 10. MQTT contract

### 10.1 Topics (all QoS 1; board client id `gw-<equipmentId>`; user name = equipment id, password = login token derived from the equipment key (see below); below `wt/v1/<equipmentId>/` only)

| Topic | Direction | Content |
|---|---|---|
| `wt/v1/<equipmentId>/up/data` | gateway to backend | sealed batch of frames |
| `wt/v1/<equipmentId>/up/hb` | gateway to backend | sealed heartbeat every 10 s |
| `wt/v1/<equipmentId>/up/evt` | gateway to backend | sealed events and command results |
| `wt/v1/<equipmentId>/up/state` | gateway to backend | **plain**, retained: `online` (birth) / `offline` (last-will) |
| `wt/v1/<equipmentId>/dn/ack` | backend to gateway | sealed: highest sequence stored |
| `wt/v1/<equipmentId>/dn/cmd` | backend to gateway | sealed commands: write, live on/off, open setup, reboot, OTA |
| `wt/v1/<equipmentId>/dn/map` | backend to gateway | sealed register map |

**Login token.** The board never sends its key. The password is `base64url(HMAC-SHA-256(key = equipment key, message = "wt-mqtt-login/v1|<equipmentId>"))` (43 characters, shared vectors in the backend's `test-vectors/mqtt-login.json`). A captured token lets someone connect until the key is rotated but cannot read or forge a sealed message, because sealing uses a different derivation of the key. The broker also enforces: the last-will may only be the board's own `up/state`; publishing outside the board's own `up/*` topics, subscribing to anything else (or any wildcard), or a message over 64 KB disconnects the board; one connection per board (a new login replaces the old); revoke and rotate drop the connection within seconds; 10 failed logins per source address per minute shut that address out for the rest of the minute.

Chargers do not use MQTT; they use OCPP (section 13).

### 10.2 The sealed envelope
Every message except `state` is: version (1 byte), key id (2), counter (4), random nonce (12), ciphertext, authentication tag (16). The ciphertext is **AES-256-GCM** of a **MessagePack** body, with the topic and counter as authenticated data; the encryption key is derived (HKDF) from the equipment key. Result: confidentiality (a shared or leaked broker login reveals nothing), integrity, and replay protection (the backend rejects a counter it has already seen and a timestamp outside a 5-minute window). The ESP32-S3 has hardware AES and SHA, so cost is negligible.

### 10.3 Data batch body
`{ boot, seq_first, seq_last, map_ver, frames: [ { t, seq, blocks: [ [firstRegister, [word, word, …]], … ], flags } ] }`. Register addresses and raw words only; **key names are not sent**. The backend knows the names from `equipment_metrics` for that map version. The ESP sends the list of keys once per boot in a `map_ack` event so the server can detect a mismatch.

### 10.4 End-to-end acknowledgement
The broker's own acknowledgement only proves the broker got a message. The backend sends `dn/ack` with `{boot, seq}` **after** the data is durably stored (the R2 part is written, 11.4). The ESP deletes batches up to that sequence and keeps the rest. On reconnect it resends everything not acknowledged. The backend ignores duplicates by `(boot, seq)`. This makes a Render restart, a broker restart and a Wi-Fi drop all harmless apart from delay.

### 10.5 Register map
The server builds the map from the catalogue: the list of requests (first register, count), the cadence class of each, which are writable with minimum, maximum and whether verified, and a version number (hash). It is sent retained on `dn/map`, stored by the ESP, and re-sent when the catalogue changes. Adding a polled register is a database change, not a reflash.

### 10.6 Commands
`{ id, type, args, issued_at, expires_at }`, sealed with a counter. Types: `write` (key, value), `live` (on, for N seconds), `open_setup` (minutes), `reboot`, `ota`. The ESP answers on `up/evt` with the same `id`. A command not acknowledged by its expiry is marked expired in the database.

### 10.7 Heartbeat body
`uptime_s, boot, seq_sent, seq_acked, queue_frames, queue_bytes, rssi, wifi_channel, ip_last_octet, heap_free_min, modbus_ok_pct_5min, last_modbus_ok_age_s, inverter_online, fw_version, map_ver, clock_valid, clock_source (ntp|rtc), device_time_ms, reset_reason`.

---

## 11. Backend (`waytara-backend`)

### 11.1 Modules
`config` (environment, validated at start), `http` (Fastify app and middleware), `auth` (JWT and key checks), `keys` (create, rotate, revoke, encrypt), `broker` (the built-in MQTT broker with the key-checking login hook and per-board topic rules; later `mqtt-link`, a client for Mosquitto, with the same topics; local tests use a throw-away broker), `seal` (envelope open and seal), `decode` (formulas from `equipment_metrics`), `rollup` (15-minute engine), `cadence-writer` (parts, via the `CadenceStore` interface), `supabase-sink` (service user and RPC), `live-hub` (WebSocket relay), `commands` (dispatcher), `status` (verdicts), `ocpp` (section 13), `reports` (cadence queries), `ops` (health, metrics).

### 11.2 Middleware and protection
* **Transport:** HTTPS only (Render terminates TLS), HSTS, secure headers (helmet).
* **Browsers:** CORS allow-list of the dashboard, admin app and GUI origins; no wildcard.
* **Who is calling:** every REST and WebSocket request needs a Supabase JWT, verified with `jose` against the project JWKS (signature, issuer, audience, expiry). Then `can_access_site` is checked for the equipment in the request. Gateways authenticate by key (broker login) and chargers by key (OCPP login); a user token never works for those and a key never works for REST.
* **Abuse:** rate limits per IP and per user (stricter on login-like routes and key creation), request size limits, WebSocket message size and rate limits, connection caps per IP and per equipment.
* **Input:** every body, query and MQTT/OCPP message is parsed with a schema; unknown fields rejected.
* **Secrets:** only in Render settings. Logs redact keys, tokens and passwords; every request has an id.
* **Errors:** a central handler returns safe messages; details only in logs.
* **Audit:** key creation, rotation, revocation, failed key attempts, setting writes and role-sensitive reads go to `equipment_key_events` / `audit_log`.

### 11.3 REST and WebSocket endpoints (all under `/v1`)

| Endpoint | Who | Purpose |
|---|---|---|
| `GET /healthz`, `GET /readyz` | public / monitor | liveness, and readiness (broker, Supabase, R2 reachable) |
| `POST /equipment/{id}/keys`, `POST …/keys/{kid}/rotate`, `DELETE …/keys/{kid}` | staff on the site, admin | key lifecycle (7.1) |
| `GET /equipment/{id}/keys` | same | list fingerprints, last used, status (never the key) |
| `GET /equipment/{id}/status` | customer, staff | last known state and times (used on page refresh) |
| `POST /equipment/{id}/live` | customer, staff | request Go Live; returns a short-lived WebSocket ticket |
| `WS /live?ticket=` | same | live frames, decoded and filtered to what the user may see |
| `GET /reports/cadence` | customer, staff | `equipment, from, to, keys[], format` (rows or CSV); range limited to 28 days back |
| `GET /speedtest` | gateway during setup | payload for throughput test |
| `WSS /ocpp/{chargePointId}` and `WSS /{secret}/{chargePointId}` (13.2) | charger | OCPP 1.6-J; identified by Basic authentication, or by the secret in the path |
| `POST /commands` (internal path used by the Supabase listener) | service | queue a write |

### 11.4 Pipeline for inverter data
1. Open the sealed batch, check counter and time window, check `(boot, seq)` for duplicates.
2. Decode each register block with the formulas of the map version (scale, offset, signed, bit masks, combined two-word values, enums). Values outside `valid_min`/`valid_max` are kept in the CSV but flagged and **not** passed to summaries ("no false data").
3. Add to the **5-minute CSV part** for the equipment (11.5) and to the **live hub** if someone is watching.
4. Feed the **rollup engine** (11.6).
5. When a part is written to R2 successfully, send `dn/ack` for the sequences it covers.
6. Every **upload interval** (default 900 s, per-equipment setting) write closed 15-minute buckets and the latest values to Supabase (11.7).

### 11.5 Cadence files: layout, and where to keep them (R2 chosen, S16)

**Where to keep them.** Every ordinary object store treats a file as one piece that is written whole, so none of them can add rows to the end of a CSV. The parts layout below works the same on all of them.

| Store | Free allowance | Deletes old files by itself | Notes |
|---|---|---|---|
| **Cloudflare R2 (default)** | 10 GB, 1M writes, 10M reads a month, egress free **[verified]** | Yes, lifecycle rule by prefix **[verified]** | Best free egress; S3 API; may ask for a payment method when you enable R2 (16.3). |
| Backblaze B2 | first 10 GB free; egress free up to 3 times what you store; 2,500 read-type calls a day free **[third-party summaries]** | Lifecycle rules exist **[unverified]** | S3-compatible **[unverified]**. Egress ratio rule matters if reports are read a lot. |
| Oracle Cloud Always Free | 20 GB (one source says 10 GB) and 10 TB egress **[third-party]** | Lifecycle policies **[unverified]** | S3-compatible; needs a card and account approval; more setup. |
| **Supabase Storage** | 1 GB, 2 GB egress a month, 50 MB per file on free projects **[third-party]** | **No**: the backend runs a daily cleanup job | Nothing new to sign up for, same login system and signed links. Capacity check **[estimate]**: 28 days of gzipped cadence is about 17 MB per inverter, so 1 GB holds about 50 inverters. The right fallback for a small pilot. |
| Google Cloud Storage / Azure append blobs | not checked | | GCS can join objects server-side and Azure has real append blobs, but their free tiers were not verified, so I do not plan on them. |

**Recommendation:** R2 now; Supabase Storage as the "no new account" alternative while you are piloting; the choice is a setting (`STORE_DRIVER`), not a code change. To you it still looks like one CSV per device for 28 days: the report and download endpoints join the parts and print a single header.

**Layout (R2 or any S3-style store)**
* Bucket `waytara-cadence`, **private**.
* Object key: `cadence/v1/<equipmentId>/<yyyy>/<mm>/<dd>/<HH><mm>.csv.gz`, one per aligned 5-minute window (288 per day). The key is deterministic, so a retry overwrites the same object; if late frames arrive for a closed window the backend reads, merges by sequence and rewrites it.
* Format: first line `# map_version=…`, then a header `ts_utc,<key>,<key>,…`, then one row per sampling instant with decoded values, empty where a value was not sampled that instant. Fast values fill most rows; slower ones appear when read. Values are in the units of the catalogue.
* At 02:00 the previous day's parts are merged into `…/<dd>/day.csv.gz` to make reports faster; parts are then removed by the lifecycle rule.
* **Lifecycle rule:** prefix `cadence/`, delete after **30 days**. The report page offers the last **28 days**, so deletion lag never shows.
* Free-tier fit **[estimate]**: about 8,640 writes per equipment per month, so about 100 equipments per million writes.

### 11.6 15-minute rollups (S3)
Port of the working firmware maths (`rollup.h`, documented in `HOW_IT_WORKS.md`): sample-and-hold with a hold time of `min(7200, max(60, 2 × cadence))` seconds, per value: time-weighted sum, covered seconds, minimum, maximum, last, count, and positive/negative split where it applies. Buckets are aligned to the wall clock. Open bucket state is saved to `equipment_open_bucket` so a restart loses nothing; late frames recompute and **upsert** the affected closed bucket. The engine is tested against golden vectors taken from the existing firmware's output.

### 11.7 Supabase writes
Through the limited **service user** and `SECURITY DEFINER` functions named `gw_*` (the backend never holds the `service_role` key): `gw_ingest_tick` (latest values, closed buckets, heartbeat), `gw_report_config` (initial settings read and write results into `equipment_configs`), `gw_pending_writes` (settings the customer changed that are not yet applied, also run at start-up to catch up after a sleep), `gw_ev_*` (section 13). Each function refuses anyone who is not the service user.

### 11.8 Go Live (S2)
1. The dashboard calls `POST /equipment/{id}/live`. The backend checks access and returns a one-time ticket valid 30 seconds.
2. The dashboard opens `WS /live`. The backend sends a `live on` command to the gateway (duration 5 minutes, renewed while the page is open).
3. The gateway now sends **every frame immediately** (not in 30-second batches). The backend decodes, filters to the keys the viewer may see, and pushes them.
4. When the user presses stop, closes the page, or the connection drops, the backend sends `live off` and the gateway returns to batches. The page goes back to the normal Supabase realtime channel with 15-minute data.
5. Extra delay compared with the browser talking to the broker directly: one backend hop. Against a 5-second cadence and a read time of about half a second this is small **[estimate]**. A direct browser connection becomes safe only when each customer can get a login limited to their own topics (a broker that can create a login per customer; Mosquitto with the dynamic-security plugin can).

### 11.9 Status verdicts
The backend keeps the last heartbeat time in memory and writes to `equipment_heartbeat` immediately when the state changes and every 30 seconds otherwise (`heartbeat_s` = 30). The existing database trigger and `pg_cron` check (migration `20261012010000_device_status`) stay as the authority: `online`, `device_unreachable`, `offline`, `never_seen`, offline after 3 intervals and never less than 30 seconds. So if the backend itself dies, the database still marks the unit offline.

### 11.10 Deployment and settings
Render web service from the repo, Node 22, build `npm ci && npm run build`, start `node dist/server.js`, health check path `/healthz`, region closest to your users and to Supabase. Environment variables (names only; values go in Render, never in git): `NODE_ENV`, `PORT`, `PUBLIC_BASE_URL`, `ALLOWED_ORIGINS`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_USER_EMAIL`, `SUPABASE_SERVICE_USER_PASSWORD`, `KEY_ENCRYPTION_MASTER` (32 bytes, base64), `STORE_DRIVER` (`r2`, `s3` or `supabase`), `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `BROKER_MODE` (`embedded` now, `external` later), and for `external` only: `MQTT_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD`, `MQTT_CA_PEM`, `OCPP_HOST_SUFFIX` (for example `ocpp.waytara.com`), `LOG_LEVEL`. A `.env.example` with fake values is committed; real `.env` is git-ignored.

---

## 12. Heartbeats and status

### 12.1 Inverter gateway

| Item | Value |
|---|---|
| Gateway to backend | sealed heartbeat every **10 s** (10.7) |
| MQTT keep-alive | 30 s; last-will `offline` on `up/state` so a dead connection is known within about 45 s |
| Backend verdict | `online`: heartbeat within 30 s and the inverter answered in the last 60 s. `device_unreachable`: heartbeat fine but 3 or more consecutive inverter failures ("the board is online, the inverter is not answering"). `offline`: no heartbeat for 3 intervals (90 s, minimum 30 s). `never_seen`: before the first one. |
| Written to Supabase | on change, and every 30 s |
| What the dashboard shows after a refresh | the stored verdict, last seen, device clock minus server clock ("sync time"), queue depth, signal; then the live channel |

### 12.2 EV charger (OCPP)

| Item | Value |
|---|---|
| OCPP `Heartbeat` | the server returns **30 s** in the `BootNotification` response; the charger must send a `Heartbeat` at least that often when idle |
| WebSocket ping | the server pings every **30 s**; no pong within **10 s** closes the socket |
| Online | socket open and any OCPP message in the last 2 × 30 s |
| Degraded | socket open but no OCPP message for 60 to 120 s |
| Offline | socket closed or no message for 120 s |
| Written to Supabase | on change, and every 30 s while online (`last_heartbeat_at`, `charger_online_status`, which already exist in the catalogue) |
| **During a charging session** | The charger is told to send `MeterValues` every **30 s**, the same period as the heartbeat, so each session point carries the meter value, power, current and voltage together with a fresh heartbeat time. Each point is stored in `ev_session_samples` (13.5) and the live value goes to the session page. If a charger ignores the interval, the backend sends `TriggerMessage(MeterValues)` every 30 s itself **[unverified: depends on the charger supporting remote trigger]**. Any status change or error during the session is stored with its time (`ev_events`). |

---

## 13. EV chargers (OCPP)

### 13.1 Scope
The backend is the OCPP **central system** for OCPP 1.6-J. The Plugzmart 7.4 kW AC charger is the first target. A raw log of every OCPP frame is stored as a file in R2 for 30 days (`ocpp/<chargePointId>/<date>.jsonl.gz`); the structured results go to Supabase.

### 13.2 Connecting (wss, S9 revised)
**Decision:** the charger connects over **TLS (wss://)** with a path. TLS encrypts everything after the connection starts, including the path, so a secret in the path or a password is not visible to someone watching the network. This is OCPP security profile 2, which the OCPP security sources call the level for field use **[verified: Easee and WinCC OA documentation]**.

**What you told me about the Plugzmart charger (2026-10-14):** its app has one field where you type the server address and submit; no user name or password fields; no TLS or CA-certificate option; separate screens for the charger's own network connection and for installers; and it shows its charger id. The address format you gave is `ws://random.domain.com:9220/WT_PZ_7k_1`, which says three things:
* The **path is the charger id** (`WT_PZ_7k_1`, case sensitive). That is the OCPP identity, and it is not secret.
* The scheme in your example is **`ws://`**, not `wss://`. Whether the charger accepts `wss://` at all is not known yet.
* The **port is 9220**. Render exposes only ports 80 and 443 on a public service and does not forward other ports **[verified, secondary: Render community and docs]**, and Cloudflare's proxy only passes a short list of ports (80, 8080, 8880, 2052, 2082, 2086, 2095 for plain traffic; 443, 2053, 2083, 2087, 2096, 8443 for TLS) **[unverified: forum reports]**. 9220 is on neither list.

**Does the Plugzmart charger support wss? Not publicly documented.** I searched twice for Plugzmart documentation (OCPP version, security profiles, wss, TLS) and found only company background: an IIT Madras incubated maker of AC and DC chargers with its own charger-management software. The only evidence is your own example address, which uses plain `ws://` on port 9220. Two ways to settle it: ask Plugzmart support four questions (OCPP version, supported security profiles, wss/TLS support, how the charger decides which certificate authorities to trust), and run the probe test below, which needs no answer from them.

**Decision tree** (the probe in section 21, spike 6, tells us which branch):

| Branch | If the charger can | Route | Secret |
|---|---|---|---|
| A | use `wss://` and port 443 (or no port) | straight to Render, no extra service | secret as an extra path segment, or random host name (TLS hides it) |
| B | only `ws://`, but the port can be changed to 80 | Cloudflare proxied record in front of Render (13.6) **[unverified]** | random host name is the secret (plain text on the wire) |
| C | only `ws://` **and** only port 9220 (or another port Cloudflare and Render do not serve) | a small public server (a "front door") that listens on 9220 and relays each connection to the backend over `wss://` (13.6) | random host name is the secret (plain text on the wire) |

In branches B and C the charger's own id from the path is checked **together with** the random host name: both must match one registered charger, so guessing either alone is useless.

**Address shapes the backend accepts** (the key is created in the admin app, 7.1):

| # | Address | The charger needs | Notes |
|---|---|---|---|
| 1 | `wss://ocpp.waytaraenergy.com/ocpp/<deviceName>` plus **Basic authentication** (user = device name, password = key) | URL with path, and user/password fields | The standard form. Nothing secret in the address. |
| 2 | `wss://ocpp.waytaraenergy.com/<secret>/<deviceName>` | URL with path | **Your charger's case** (one URL field in its app; no user name, password or CA upload): **recommended**. The secret is 24 random lowercase letters and digits (about 124 bits). The last path segment is the OCPP identity the charger adds or that you type as the device name. |
| 3 | `wss://ocpp.waytaraenergy.com/<secret>` | URL with path | The secret alone identifies the charger; whatever identity the charger sends is only checked against its `BootNotification` serial number. |
| 4 | `wss://<random>.<dedicated-domain>/<deviceName>` (your `random.domain/name` form) | URL with path; a dedicated one-level domain with a proxied wildcard record | Works, but once TLS is on a random host name adds little beyond shape 2, and it needs a wildcard certificate and wildcard DNS. Optional. |

In every shape: unknown secrets, names and credentials are refused **before** the WebSocket upgrade with a plain 404 (no hint which part was wrong); attempts are rate limited per address; messages are validated against the OCPP 1.6 JSON schemas; and the secret is redacted from every log line (the proxy in front and the charger's own diagnostics may still show it, which is why a key can be rotated in one click).

**What the charger must support for wss:** TLS 1.2 or later, SNI (sending the host name), and trust in the certificate authority behind our certificate. Cheap chargers sometimes have an old trust store or no way to upload a CA. This is the main risk, so the settings page is checked for a "TLS / wss / CA certificate / security profile" option. If it cannot do TLS, the fallback in 13.6 applies.

**Where the certificate comes from.** Render issues and renews the certificate for its own address (`<service>.onrender.com`) and for any custom domain you add, so no certificate work is needed on your side. If the address goes through Cloudflare's proxy instead, Cloudflare presents its own certificate; WebSockets are supported there. Which issuing authority sits behind each certificate, and whether your charger trusts it, is **[unverified]** and is decided by the charger test in section 21.

Question **O6** (route A, B or C) is answered by the probe test; shapes 1 to 3 need the charger to accept a path.

### 13.3 Messages handled
`BootNotification` (answered Accepted with the heartbeat interval), `Heartbeat`, `StatusNotification`, `Authorize`, `StartTransaction`, `MeterValues`, `StopTransaction`, `DataTransfer` (logged), `DiagnosticsStatusNotification`, `FirmwareStatusNotification`. From the server: `ChangeConfiguration` (sets `MeterValueSampleInterval` = 30 s and `MeterValuesSampledData`), `GetConfiguration` at boot (learns what the charger supports), `RemoteStartTransaction`, `RemoteStopTransaction`, `Reset`, `UnlockConnector`, `SetChargingProfile` (limits), `TriggerMessage` (also used to fetch a fresh meter value on demand, for example when a customer opens the live session page). These match the actions already in `equipment_templates` (remote_start_transaction, reset, trigger_message …).

### 13.4 Duplicate and offline handling
* A transaction is unique per `(charge point, transaction id)`. Transactions started offline arrive later with their own timestamps and are stored in order.
* Energy = meter stop − meter start. If it is negative or implausible (more than the rated power × duration) the session is marked `suspect`, not corrected.
* A charger that reconnects while the old socket still looks alive replaces it only if the old one fails a ping within 10 s. A second connection with the right key never silently kicks a healthy one; it is refused and an alert is raised (13.6).

### 13.5 What we store for a session (S13)
Existing table `ev_sessions` (start, end, start and end energy, stop reason, test flag) is **extended**, and a new table holds the points during the session.

`ev_sessions` new columns: `charge_point_id`, `connector_id`, `ocpp_transaction_id`, `id_tag_hash` (the card id is hashed; a short label is shown to the customer), `meter_start_wh`, `meter_stop_wh`, `status` (`active|completed|suspect|aborted`), `source` (`ocpp|inferred|simulated`), `peak_power_kw`, `avg_power_kw`, `max_current_a`, `soc_start_pct`, `soc_end_pct`, `charging_seconds`, `idle_seconds`, `cost_amount`, `tariff_snapshot` (the rates used), and the energy split: `energy_from_solar_kwh`, `energy_from_battery_kwh`, `energy_from_grid_kwh`, `energy_unattributed_kwh`, `solar_share_pct`, `site_data_coverage_pct`.

New `ev_session_samples` (one row per MeterValues sample, every 30 s with the heartbeat, 12.2): `session_id`, `ts`, `energy_kwh` (meter register), `power_kw`, `current_a_l1/l2/l3`, `voltage_v_l1/l2/l3`, `current_offered_a`, `power_offered_kw`, `soc_pct`, `temperature_c`, `frequency_hz`, `power_factor`, the **site figures at that moment** `site_load_w`, `pv_w`, `battery_w` (positive = discharging), `grid_w` (positive = import), the **split of this sample** `ev_from_solar_w`, `ev_from_battery_w`, `ev_from_grid_w`, and `raw` (the original measurands with their units). Only columns the charger or the inverter actually reported are filled; empty means "not reported", never zero.

**Where the site figures come from.** The inverter at the same site (`pv_total_power_w`, `battery_power_w`, `grid_total_power_w`, `load_total_power_w`, the 5-second values). The backend uses the latest reading no older than 60 seconds; if there is none, the site columns and the split stay empty for that sample and `site_data_coverage_pct` records how much of the session had site data. Sign conventions are from the register decode: grid above zero is import, battery above zero is discharge **[verified: DEYE_8K_REGISTER_DECODE.md]**.

**The split rule (S19, S24: the charger is behind the inverter, on its load output).** First the inverter's own figures give the **house pools** for each moment: `from_battery = min(battery discharge, load)`; `from_grid = min(grid import, load − from_battery)`; `from_solar = load − from_battery − from_grid`, never more than the solar being produced (any excess is recorded as unattributed). Then the car draws from the pools **in the order you described: solar first, then battery, then grid**: `ev_from_solar = min(P, from_solar)`; `ev_from_battery = min(P − ev_from_solar, from_battery)`; `ev_from_grid = P − ev_from_solar − ev_from_battery`. Session energy from each source is the sum over the samples, scaled so the three together equal the meter energy. Because the pools come from a power balance of measured figures, the result is an **estimate**, and the page says so. Sign conventions: grid above zero is import, battery above zero is discharge **[verified]**. For other devices later, the pools are shared (14.5).

**Units:** a charger may send Wh or kWh, W or kW. Each value carries its unit in the OCPP message and the decoder converts by unit, not by assumption (Appendix 2).

**Customer view:** a session page with a power curve, energy accumulating over time, current and voltage per phase, charging versus idle time, peak and average power, cost so far and final, and a **panel for each session**: solar power, home load, grid import and battery power over the session, and the energy and percentage that came from solar, from the battery and from the grid. Live while charging, from the same samples.

**Retention (S18):** samples **6 months**; sessions (one row each) long term; raw frames 30 days.

### 13.6 Transport security, and the ws:// fallback (S9)
**Primary: wss (13.2).** Render accepts WebSocket connections over TLS on port 443 directly. Render redirects plain `ws://` and port 80 to HTTPS and does not upgrade them **[verified, secondary]**, which is exactly why the ws:// plan needed Cloudflare and why wss is simpler.

Controls that apply to every charger link:
1. One secret per charger, shown once, revocable in one click (7.1); rotate after any site visit or suspicion.
2. Unknown secrets refused before upgrade; rate limit and lock-out per address and per charger.
3. A healthy live connection is never replaced by a newcomer (13.4); a second attempt raises an alert to staff.
4. Optional per-charger **IP allow-list** (the site's public address) and an alert on a new address.
5. The server never trusts the charger for money or energy beyond what the meter says, and flags implausible sessions (13.4).
6. Commands that could do harm (remote start, limits, reset) are available only to signed-in users with access, rate limited, and logged.

**Fallback only if the charger cannot do TLS: plain ws://.** Facts: OCPP security profile 0 has no authentication and profile 1 has Basic authentication over an unencrypted connection; both are described as development-grade **[verified: Easee, WinCC OA]**. With plain ws://, Render cannot be reached directly. The workaround is Cloudflare in front: a proxied record per charger (or a proxied wildcard record, which Cloudflare supports on every plan **[verified]**), the charger connecting to `ws://<random>.<domain>` on port 80 where the random host name is the identity and the secret, **Always Use HTTPS** switched off for those names only, and Render configured with a matching wildcard custom domain. Whether Cloudflare forwards a plain WebSocket upgrade on port 80 this way is **[unverified: spike]**, and the plain-HTTP ports it proxies are only 80, 8080, 8880, 2052, 2082, 2086 and 2095 **[unverified: forum reports]**. **The "front door" for a fixed port such as 9220 (branch C).** A small server you rent (a basic virtual machine at any provider; I have not priced one) runs a reverse proxy that listens on port 9220 for `ws://`, reads the `Host` header and the path, and opens a `wss://` connection to the backend on Render, passing the host name, the path and the charger's public address along. DNS for the charger names is a plain (grey-cloud) wildcard record pointing at that server, so Cloudflare's port list does not matter. The front door holds no data and no keys; the backend still does all checks. It is one more thing to keep running, so it is used only if branch C is real. Render itself cannot listen on 9220. In that fallback the secret travels in clear text, so anyone who can see the charger's network traffic can learn it; the allow-list in control 4 becomes mandatory and the plan moves to wss as soon as the charger firmware allows.

### 13.7 Not in scope now
OCPP 2.0.1, ISO 15118 plug-and-charge, payments, roaming, smart-charging optimisation across several chargers.

---

## 14. Supabase changes (migrations to write, applied with `npx supabase db query --linked --file`)

### 14.1 New tables and columns
| Name | Purpose |
|---|---|
| `site_staff` | site assignments (6.2) |
| `equipment_keys` | `id, equipment_id, kind (gateway|charger), label, key_ciphertext, key_fingerprint, created_by, created_at, last_used_at, last_used_ip, expires_at, revoked_at, revoked_by` |
| `equipment_key_events` | audit of key actions and failed attempts |
| `gateway_devices` | `equipment_id, hardware_id, fw_version, map_version, claimed_at, claimed_by, last_boot_at, reset_reason, ota_state` |
| `register_map_versions` | `equipment_id, version, hash, built_at, body` |
| `ocpp_charge_points` | `equipment_id, charge_point_id, vendor, model, serial, firmware, meter_type, connectors, config, last_boot_at` |
| `ev_session_samples`, extended `ev_sessions` | 13.5 |
| `ev_events` | status changes, faults, authorisation results |
| `gateway_service_users` | the identity the backend signs in as |
| `equipment_metrics.poll_enabled` (boolean) | the gateway polls a key when `show_for_user` or `poll_enabled` (14.3) |

### 14.2 Functions
`can_access_site`, the `gw_*` family (11.7), `gw_create_key` (called by the backend after its permission check), and a rewrite of the read policies listed in 6.2.

### 14.3 One new idea: poll flag
`show_for_user` decides what a customer sees. A separate `poll_enabled` decides what the gateway reads. Default: `poll_enabled = show_for_user` plus registers a calculated value needs. An admin can switch on extra registers for a single equipment to diagnose a problem; the map version changes and the gateway starts reading them within a minute.

### 14.4 Retired once the new path is proven
`equipment_ingest_tokens`, `request_live` / `device_live_tick`, `ingest_device_tick`, the Apps Script cadence sheet and `apps/web/src/app/api/cadence`. They stay until cut-over is verified, so rollback is possible.

---
### 14.5 Usage summary for any device in the property (S25, designed now, built when the first non-EV device arrives)
The EV charger is the first **metered load**. The same model covers anything else that reports its own power or energy: a smart meter on an air conditioner or water heater, a smart plug, a sub-meter on a pump.
* **One engine for all.** The backend module `attribution` takes (a device's power at that moment, the house pools from 13.5) and returns the solar, battery and grid parts. The EV uses it from day one, so nothing is redone later.
* **Rule with several devices.** The pools are shared and each unit of load is counted once. Default: every device gets the house mix in proportion to its power; a site may name one or more priority devices (the EV, as you described) that draw solar first, then battery, then grid, and the remaining pools are shared by the rest. The total attributed to all devices never exceeds the house load; the remainder is shown as "rest of the property".
* **Tables (added with the first non-EV device):** `site_load_devices` (`site_id`, `equipment_id`, `label`, `kind`, `meter_source`, `priority`), `load_usage_samples` (`equipment_id`, `ts`, `power_w`, `energy_wh`, the site figures, the split), and `load_usage_daily` (per device per day: energy, from solar / battery / grid, cost). EV sessions keep `ev_session_samples` and also feed `load_usage_daily`, so a customer sees EV and other devices in one summary.
* **Where the readings come from for non-EV devices:** whichever gateway or protocol the device has (Modbus meter on the same board, OCPP, or another gateway). That part needs its own register map and is a separate piece of work.


## 15. Changes in this repo (dashboard, admin, shared code)

| Area | Change |
|---|---|
| Go Live (`components/dashboard/go-live.tsx`) | open `WS /live` through the backend ticket flow; on stop, return to the Supabase realtime channel |
| Overview and Monitoring | show the live values while Go Live is on; show stored status and "synced X ago" (clock difference) on refresh |
| Reports (`report-center.tsx`, `report-day-data.ts`) | cadence report reads `GET /v1/reports/cadence` instead of Google Sheets; date picker limited to the last 28 days; parameter picker limited to keys the user may see |
| Settings | unchanged for the customer; the pending/confirmed/failed state now comes from the backend's confirmation |
| Admin and employee apps | site staff assignment (admin); equipment **Keys** tab (create, rotate, revoke, copy URL); gateway status panel; EV charger page with sessions |
| Customer EV page | session list and session detail with the curve (13.5) |
| Shared package | the register decode rules move to a small shared package used by backend tests and (later) any direct-connection path |
| Removed later | Google Sheets cadence code and Supabase-direct ingest (14.4) |

---

## 16. Account setup guides (do these when the phase says; I tell you when)

You do not paste passwords to me. Values go into Render's environment page and into a git-ignored `.env` on your computer.

### 16.1 GitHub access (needed first)
* **Use HTTPS, not SSH.** The SSH test now trusts GitHub's host key but ends with "Permission denied (publickey)": this computer has no SSH key (only a `known_hosts` file exists in `~/.ssh`). You do not need one: the GitHub command-line login on this computer (`gh`, account `hellowaytara`, HTTPS, scopes `repo` and `workflow`) already works, and the `esp32 scripts` repo already uses an HTTPS remote. So both new repos use HTTPS addresses: `https://github.com/Waytara-Energy/waytara-backend.git` and `https://github.com/Waytara-Energy/ESP32-S3-GUI.git`.
* Both repos are reachable and empty. Whether the account may push to them is confirmed by the first push (which only happens when you say "push").

### 16.2 MQTT broker: nothing to create now
While the broker is built into the backend (3.3) there is **no account to create and no password to set**: boards authenticate with their equipment key. EMQX and HiveMQ are not used.

**When you have a server (stage 2)** I will give you a short, exact guide for it. In outline: rent a basic Linux server, point a name such as `mqtt.waytaraenergy.com` at it, install Eclipse Mosquitto with the dynamic-security plugin, get a certificate for the name, open port 8883, and give the backend the broker address and one control login. Boards then move by a signed command.

### 16.3 Cloudflare R2 (needed at phase 2)
Steps follow Cloudflare's documentation **[verified]**; button names can differ slightly. **Only R2 needs this account.** Your domain's DNS stays at Vercel (S26); do not add the domain to Cloudflare. Create the account when phase 2 starts; I will tell you.
1. Create a Cloudflare account at cloudflare.com and verify the email.
2. In the dashboard open **Storage & databases > R2 > Overview** and complete the checkout flow to add the R2 subscription. The page says it is "free to get started with included free monthly usage" and bills monthly above that; it does not say whether a card is required, so expect to be asked.
3. Create a bucket named `waytara-cadence`. Leave it private (no public access, no custom domain).
4. Open the bucket, **Settings**, **Object Lifecycle Rules**, **Add rule**: prefix `cadence/`, delete objects after **30** days. Add a second rule for prefix `ocpp/`, **30** days. **Save changes.**
5. Back on **R2 Overview**, under **Account Details** click **Manage** next to **API Tokens**, then **Create Account API token** (or User API token). Choose **Object Read & Write**, scope it to the `waytara-cadence` bucket, and create it. Copy the **Access Key ID** and **Secret Access Key** now; the secret is shown **once**.
6. Copy your **Account ID** from the dashboard. The S3 endpoint is `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
7. Put `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` into Render settings. Tell me the bucket name and that you did it.

### 16.3b Alternative, not chosen: Supabase Storage instead of R2
No new account. In the Supabase dashboard open **Storage**, create a **private** bucket named `waytara-cadence` (no public access), and tell me: I add the policies by migration so only the backend service user can write and read, and the backend downloads and streams the files to the user after its own permission check. The 50 MB per-file limit on free projects is no problem for 5-minute parts. There is no automatic deletion, so the backend runs a daily cleanup job (delete anything older than 30 days) **[estimate: needs the spike]**.

### 16.4 Render (phase 2)
1. Sign in at render.com with GitHub and allow access to the `waytara-backend` repo.
2. **New > Web Service**, pick the repo, runtime Node, build `npm ci && npm run build`, start `node dist/server.js`, instance type Free for now, region nearest to your users.
3. Add the environment variables from 11.10 in the **Environment** page. Set the health check path to `/healthz`.
4. Add a free uptime monitor (any service) calling `https://<service>.onrender.com/healthz` every 5 minutes (S4). Switch to a paid instance before customers (S4).
5. Custom domain: your DNS is hosted by **Vercel** (S26), so the record is added there: in the Vercel dashboard open the domain `waytaraenergy.com`, its DNS records, and add a **CNAME** with name `hub` and the target Render shows, then in Render add `hub.waytaraenergy.com` as a custom domain. Names agreed on 2026-10-15: `hub.waytaraenergy.com` is the Render backend (REST, board connection, live data, chargers); `server.waytaraenergy.com` is reserved for your own server (VPS); `mqtt.waytaraenergy.com` will point at the Mosquitto broker when it exists and wait for it to verify. Nothing moves to Cloudflare. (Menu names in Vercel may differ slightly; I will check them with you on screen.)

### 16.5 Vercel (GUI, phase 1)
Import the `ESP32-S3-GUI` repo, framework preset Vite, add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL` (public values only). Add a custom domain such as `setup.<domain>` later.

### 16.6 The charger address (phase 5)
**Simplest start, no extra account:** use the Render address, `wss://<service>.onrender.com/<secret>/<deviceName>`. Nothing to configure.

**Recommended for the field, on your own domain (S26):**
1. In Render, open the service, **Settings > Custom Domains > Add Custom Domain**, enter `ocpp.waytaraenergy.com`, and note the CNAME Render shows ([Render custom domains](https://render.com/docs/custom-domains)). Render then issues the certificate by itself.
2. In Vercel's DNS records for `waytaraenergy.com`, add that CNAME with name `ocpp`. Wait until Render shows the certificate as issued. The Cloudflare proxy is not involved in route A.
3. In the admin app, create the charger key (7.1); it shows the full `wss://` address. Type it into the charger's server address field.
4. Test before touching the real charger, with a WebSocket test client such as `wscat`: connect to the address, expect the connection to open (HTTP 101), and expect a plain 404 for a wrong secret.

**Only if the charger cannot do TLS:** the plain ws:// fallback in 13.6 (Cloudflare proxied wildcard record, Render wildcard custom domain, Always Use HTTPS off for those names). I would then walk you through it step by step against your live dashboards.

---
### 16.7 If you ever move the domain's DNS to Cloudflare (not needed now)
Only the **DNS hosting** would move, not the website, and not the registration, which stays at GoDaddy unless you transfer it. What exists today at `waytaraenergy.com` **[verified: public DNS lookup 2026-10-14]**: name servers at Vercel; the website and `www`, `admin` records; **Microsoft 365 email** (an `outlook.com` mail record, an SPF record, a Microsoft verification record) and a Google site-verification record. A move means: add the domain to Cloudflare, copy **every** record exactly (website, `www`, `admin`, mail, SPF, verification, and any DKIM / autodiscover records that a lookup of the right names would show), set the website records to **DNS only** so Vercel keeps working, check them, and only then change the name servers at GoDaddy. A missed mail record breaks email. The only plan that needs Cloudflare in front of the backend is the plain-ws route B (13.2); a **separate small domain** used only for chargers would avoid touching `waytaraenergy.com` at all.


## 17. Security summary

| Threat | Control |
|---|---|
| Someone reads another customer's data on a shared broker | Every payload is sealed with the equipment's own key (10.2) |
| Fake readings or commands | Authenticated encryption, counters and time window, expiry on commands, read-back after writes |
| Stolen board | Keys in encrypted flash (production), revoke in one click, new key on re-claim |
| Wi-Fi password or key sniffed, or setup by the wrong person | Sign-in required (customer for own equipment, installer only with an admin permission); BOOT-button window; encrypted Bluetooth; single-use claim ticket; key delivered over TLS and encrypted to the board (8.4) |
| Leaked equipment key | Per-equipment, scoped, revocable, rate limited, audited; IP allow-list for chargers |
| Cross-site access by staff | `site_staff` and `can_access_site` on every table and every backend call |
| Brute force and floods | Rate limits, lock-outs, size and connection caps |
| Backend compromise | No `service_role` key; limited service user; master key only in Render; logs redact secrets |
| Render sleep or restart | Gateway buffer plus end-to-end acknowledgement; status held in the database; catch-up of pending writes at start |
| Charger link readable or copied | wss (TLS) with a secret path or password; secret redacted in logs; rotate in one click; optional IP allow-list. Plain ws:// only as the documented fallback (13.6) |
| Wrong inverter write | Range limits, writable list, verified flag, read-back, audit, unverified writes off by default |

---

## 18. Capacity and cost numbers (all **[estimate]**, measured in spikes)

| Item | Figure |
|---|---|
| Frame, fast group (33 registers) | about 100 to 250 bytes after MessagePack |
| Gateway traffic | about 0.1 GB a month per inverter including heartbeats and acknowledgements (not billed anywhere while the broker is built in) |
| Built-in broker load | a few messages a second for tens of inverters; limited by Render free memory and CPU, which the pages I read do not state **[unverified]** |
| Cadence CSV | about 5 to 6 MB a day plain, about 0.6 MB gzipped, per inverter; 28 days about 17 MB gzipped |
| Storage fit | R2: storage for hundreds of inverters, writes (8,640 per inverter per month) allow about 100 inverters per million. Supabase Storage: about 50 inverters in 1 GB |
| Flash buffer at the gateway | about 26 hours of outage |
| Supabase writes | one tick per upload interval, plus heartbeat every 30 s |

---

## 19. Test and verification plan

| Layer | How it is proven |
|---|---|
| Decoding | Golden vectors: the register words from the 54 sweep cross-checks in `DEYE_8K_REGISTER_DECODE.md` must decode to the same values |
| Rollups | Same raw inputs through the old firmware maths and the new backend produce identical buckets |
| Envelope | Test vectors (key, nonce, plaintext, expected ciphertext) run in the backend tests and in an ESP self-test over serial |
| Outage | Pull the network for 2 hours with Go Live off and on; after reconnect the CSV and buckets have no gap and no duplicate |
| Backend restart | Kill the service mid-bucket; data and buckets are complete after restart |
| Permissions | Automated tests: customer A cannot see customer B; unassigned installer sees nothing; assigned installer sees only assigned sites; a revoked key is refused within 15 seconds |
| Writes | Change a setting from the dashboard; read-back confirmed on the inverter screen; a failed write is shown as failed |
| EV | Simulator for offline start, duplicate stop, negative energy; then the real charger; stored session energy equals the charger display within the meter's resolution |
| Setup | Fresh board to online in under 3 minutes on an Android phone by a signed-in user; a signed-out user, or an installer without a permission, is refused; Forget network works |

I will tell you exactly what was and was not verified at the end of each phase.

---

## 20. Roadmap: solar inverter first, EV charger second (re-ordered 2026-10-14)

Work is done one task at a time. Before each task I brief you (what I will do, what I need, any account), you answer, I do it, then I report what is done and what needs your attention. Nothing is committed or pushed until you say "push".

### Progress (updated 2026-10-15)

| Task | State | Where |
|---|---|---|
| A1 Supabase foundation | done, live | migration 20261015000000, test 15 |
| A2 Backend skeleton | done, pushed | `waytara-backend` |
| A3 Backend core libraries | done, pushed | `waytara-backend` |
| A4a Sign-in checks, keys, claim tickets | done, pushed | migration 20261015010000, test 16, `waytara-backend` |
| A4b Broker and data intake (storage plugged in at A4c) | done | `waytara-backend` |
| A4c Supabase storage, device status, live end-to-end test | done, live (simulated board through hub) | migration 20261015020000, test 17, `waytara-backend` |

### Part A: solar inverter, from the board to the dashboard

| Task | Work | You do | Done when |
|---|---|---|---|
| A1 | **Supabase foundation:** `site_staff` (with optional expiry), `can_access_site` and the read policies that use it, `equipment_keys` and `equipment_key_events`, `gateway_devices`, `register_map_versions`, `poll_enabled`, the backend service user and the first `gw_*` functions | OK to apply to the live database; create the service user (I give the steps) | A customer sees only own site, an unassigned installer sees nothing, an assigned one sees only assigned sites, an expired permission stops access: all proven by automated tests |
| A2 | **Backend skeleton:** repo, Fastify, validated settings, health endpoints, security headers, rate limits, redacted logs, tests | Say "push" later; nothing else | Runs locally, tests pass |
| A3 | **Backend core libraries** (tests only, nothing deployed): sealed message envelope with shared test vectors, decode engine checked against the sweep values, 15-minute rollup engine checked against the old firmware maths, register-map builder (PV inputs from stock) | None | Golden-vector tests pass |
| A4 | **Backend runtime:** sign-in (JWT) checks, key endpoints and claim tickets, the built-in MQTT broker with the key-checking login, ingest to Supabase through `gw_*`, status verdicts, first deployment to Render | Create the Render service from the pushed repo; set its environment variables | A simulated board connects over `wss://`, data and heartbeat reach Supabase, a wrong key is refused |
| A5 | **Cadence storage and reports:** 5-minute CSV parts, 28-day rule, report endpoint, daily merge | Cloudflare account and the `waytara-cadence` R2 bucket (16.3) | A simulated day is stored, read back as one CSV, and old parts expire |
| A6 | **Gateway firmware foundation:** module layout, protected settings, Wi-Fi manager, connection checks, speed test, Bluetooth setup with the sign-in claim flow, sealed hello | Install Arduino tooling or let me; flash the board when I say; an Android phone | Fresh board is set up from the phone and shows online in the backend |
| A7 | **Setup web page** (Vite + React on Vercel): sign-in, equipment pick, Bluetooth, Wi-Fi, checks, speed, forget | Create the Vercel project | Same test as A6, from the deployed page |
| A8 | **Modbus engine and data path:** register map download, scheduler, frames, buffer, acknowledgements; backend writes to Supabase and the cadence store | Inverter connected to the board | A full day matches the inverter screen and the old firmware's buckets |
| A9 | **Settings write-back:** signed commands, range and verified checks, read-back, Confirmed / Failed in the dashboard | None | A changed setting is confirmed on the inverter screen; a failure shows as failed |
| A10 | **Dashboard and admin changes:** Go Live relay, 28-day cadence report, refresh status and clock difference; admin Keys tab, site staff assignment, gateway status; retire the Google Sheets path | None | Go Live starts and stops cleanly and returns to the 15-minute channel |
| A11 | **Inverter cut-over and hardening:** side-by-side run with the old firmware, over-the-air update with rollback, monitoring and alerts, handover notes | A spare board for the irreversible security steps | Old path switched off with a rollback plan |

### Part B: EV charger (starts after Part A)

| Task | Work | You do | Done when |
|---|---|---|---|
| B1 | **Charger probe** (the test service that logs what the Plugzmart charger really does), deployed on the Render backend | Type the probe address into the charger app; send me the log | Charger route A, B or C chosen |
| B2 | **OCPP server:** schema validation, boot, heartbeat, status, authorise, transactions, meter values, key-based identification, online verdict | Charger settings page screenshots | A simulator and then the real charger stay connected |
| B3 | **EV data:** extended `ev_sessions`, `ev_session_samples`, `ev_events`, the source split (EV first), 6-month retention | None | Stored energy equals the charger display; split adds up to the meter energy |
| B4 | **Customer and admin EV pages:** session list and detail with solar / battery / grid panel, charger Keys tab | None | A completed session is shown with its curve and split |
| B5 | **Field route:** DNS records in Vercel, a front-door server if the charger is stuck on port 9220 | DNS records; a rented server only if route C | The real charger completes a session |
| B6 | **EV hardening:** remote start / stop, limits, usage summary engine for other devices (14.5) | None | Remote commands confirmed on the charger |

---

## 21. Spikes (each short, each decides something)

1. **Built-in broker on Render free:** a board connected over `wss://` for 72 hours; reconnect times after a redeploy; whether the keep-alive traffic keeps the service awake; the login and topic rules refusing another board's topic. Later, on a server: Mosquitto with the dynamic-security plugin creating a client and role from the backend.
2. **Render:** sleep and restart behaviour with and without the ping, and whether outbound-only MQTT counts as activity (matters less now that the broker is outside Render).
3. **Storage:** write, list, merge and expiry of parts on R2; the cost in operations of 5-minute parts; the same flow on Supabase Storage with the daily cleanup job.
4. **Bluetooth setup** on your Android phone, and the choice between our protocol and Espressif's own provisioning.
5. **Modbus on your inverter:** largest read it accepts, response time, error behaviour.
6. **Charger probe first, then the real flow.** A tiny service on Render accepts `wss://` and logs, without storing anything else: whether the TLS handshake succeeds, the exact path the charger requests (so we learn whether it adds its own identity after what you typed), the headers it sends, and its first `BootNotification`. It answers `BootNotification` with Accepted so the charger stays up. Then: **Charger over `wss://`:** the real charger connects, completes TLS (certificate trusted), stays connected, survives a Render deploy, and a wrong secret gets a 404. Only if it fails because the charger has no TLS: the ws:// fallback through Cloudflare (13.6).
7. **Fault-word bit order** against the manual's fault table (affects `active_alerts`).
8. **Library choice** for OCPP (licence, 1.6 schemas, maintenance).

---

## 22. Review checklist for you

Please confirm or correct:
1. Section 2.3: O1 (broker hosting), O2 (the 29 unverified values, A3.5), O5 (split rule for other devices later), O7, O8.
2. Appendix 3: any key you want hidden, shown, or removed from polling.
3. Section 6.3 and 8.4: that the sign-in and permission flow matches how your team and customers work.
4. Section 13.5: the EV session panel (solar, home load, grid import, battery, and the split).

When you say the plan is verified I start phase 0 and phase 1.

---

## Appendix 1: Unverified items (honest list)

* Hardware details: the exact RS485/CAN pin numbers for this board (taken from your tested `config.h`), PSRAM size, Modbus maximum read size and timing.
* Whether R2 can append to an object (treated as no); whether R2 asks for a card at sign-up.
* Whether outbound-only MQTT counts as activity for Render's sleep timer.
* **Whether the Plugzmart charger supports wss at all:** no public Plugzmart documentation says. Their example address uses plain `ws://`. The probe on the real charger decides (13.2, spike 6). The charger supporting TLS 1.2, SNI and trusting the certificate authority behind our certificate (13.2); the plain ws:// route through Cloudflare (13.6) only matters if it does not.
* Built-in broker: Render free CPU and memory limits, and behaviour across a redeploy. Mosquitto dynamic-security command names for the installed version.
* Cloudflare plain-HTTP port list and wildcard behaviour: used only by the ws:// fallback.
* Free-tier numbers for Backblaze B2, Oracle Cloud and Supabase Storage come from third-party summaries, not the vendors' own pages.
* The OCPP library choice.
* Espressif provisioning versus our own Bluetooth protocol.
* All figures marked **[estimate]**.

## Appendix 2: OCPP measurands to storage

| OCPP measurand | Typical unit sent | Stored as | Catalogue key |
|---|---|---|---|
| `Energy.Active.Import.Register` | Wh or kWh | `energy_kwh` | `energy_active_import_register_kwh` |
| `Power.Active.Import` | W or kW | `power_kw` | `power_active_import_kw` |
| `Current.Import` (L1, L2, L3) | A | `current_a_l1..l3` | `current_import_l1_a` … |
| `Voltage` (L1-N, …) | V | `voltage_v_l1..l3` | `voltage_l1_n_v` … |
| `Current.Offered` | A | `current_offered_a` | `current_offered_a` |
| `Power.Offered` | W or kW | `power_offered_kw` | `power_offered_kw` |
| `SoC` | Percent | `soc_pct` | `ev_soc_pct` |
| `Temperature` | Celsius | `temperature_c` | `charger_body_temperature_c` / `connector_temperature_c` by location |
| `Frequency` | Hz | `frequency_hz` | `frequency_hz` |
| `Power.Factor` | none | `power_factor` | `power_factor` |
| `Energy.Active.Import.Interval` | Wh or kWh | kept in `raw` | `energy_active_import_interval_kwh` |

Unit conversion is by the unit field in each message. A message without a unit gets the OCPP default (Wh, W, A, V).

## Appendix 3: Key names (generated from the live catalogue on 2026-10-14)

"Verified" is the catalogue flag `is_verified`: **NO** means the register meaning or scaling has not been confirmed against the unit yet (decision O2). Cadence is in seconds.

How to read the columns: **Source** says where the value comes from. *Modbus read* = the gateway reads the register from the inverter (RS485). *Modbus write* = a customer setting that the gateway writes to a register and reads back; it is also read every 5 minutes. *Calculated* = made by the backend or dashboard from other values. *Record* = a site, stock or warranty record, not from the inverter. **Used in** = the dashboard section and group that show it (from the catalogue). A key shown on two pages appears once per page. **Code** = files in this repository that name the key; *catalogue only* means no source file names it, the page is built from the catalogue.

### A3.1 Values read from the inverter (99 rows; Source: Modbus read)

| Key | Label | Unit | Register | Cadence (s) | Verified | Used in | Code |
|---|---|---|---|---|---|---|---|
| `device_type` | Inverter Type |  | 0 | 3600 | yes | Device & Settings > Inverter | page.tsx, page.tsx, actions.ts +27 |
| `protocol_version` | Protocol Version |  | 2 | 3600 | yes | Device & Settings > Inverter | 20260924000200_seed_deye_instrument_catalog.sql |
| `serial_number` | Serial Number |  | 3+4+5+6+7 | 3600 | yes | Device & Settings > Inverter | page.tsx, actions.ts, page.tsx +11 |
| `control_board_firmware_version` | Control Board Firmware |  | 13 | 3600 | yes | Device & Settings > Inverter | device-about.ts |
| `communication_board_firmware_version` | Communication Board Firmware |  | 14 | 3600 | yes | Device & Settings > Inverter | device-about.ts |
| `rated_power_w` | Rated Power (W) |  | 16+17 | 3600 | yes | Device & Settings > Inverter | device-about.ts, deye-modbus-agent.mjs, 20260903020000_modbus_register_mapping.sql +1 |
| `mppt_count` | Number of PV Inputs |  | 18 | 3600 | yes | Device & Settings > Inverter | device-about.ts, 20260928010000_correct_deye_v119_registers.sql |
| `phase_count` | Number of Phases |  | 18 | 3600 | yes | Device & Settings > Inverter | actions.ts, page.tsx, stock-table.tsx +4 |
| `phase_count` | Supply Phases |  | 18 | 3600 | yes | Device & Settings | actions.ts, page.tsx, stock-table.tsx +4 |
| `grid_standard` | Grid Standard |  | 51 | 300 | yes | Device & Settings > Configuration | deye-modbus-agent.mjs, 20260924000000_add_site_engineer_role.sql, 20260924000200_seed_deye_instrument_catalog.sql +1 |
| `inverter_run_state` | Inverter Status |  | 59 | 5 | yes | Overview > Inverter status | monitoring-content.tsx, overview-live.tsx, cadence-keys.ts +3 |
| `day_active_energy_kwh` | AC Output Today | kWh | 60 | 30 | yes | Monitoring > Energy | monitoring-content.tsx, solar-monitoring-view.tsx, cadence-keys.ts +6 |
| `day_reactive_energy_kvarh` | Reactive Energy Today | kvarh | 61 | 30 | yes | Monitoring > Energy | monitoring-content.tsx, device-overview.ts, deye-modbus-agent.mjs +3 |
| `total_active_energy_kwh` | AC Output Total | kWh | 63+64 | 30 | yes | Monitoring > Energy | cadence-keys.ts, performance-metrics.ts, deye-modbus-agent.mjs +2 |
| `day_battery_charge_energy_kwh` | Charged Today | kWh | 70 | 30 | yes | Monitoring > Energy | monitoring-content.tsx, solar-monitoring-view.tsx, cadence-keys.ts +6 |
| `day_battery_discharge_energy_kwh` | Discharged Today | kWh | 71 | 30 | yes | Monitoring > Energy | monitoring-content.tsx, solar-monitoring-view.tsx, cadence-keys.ts +6 |
| `total_battery_charge_energy_kwh` | Battery Charged Total | kWh | 72+73 | 30 | yes | Reports > From inverter | cadence-keys.ts, performance-metrics.ts, deye-modbus-agent.mjs |
| `total_battery_discharge_energy_kwh` | Battery Discharged Total | kWh | 74+75 | 30 | yes | Reports > From inverter | cadence-keys.ts, performance-metrics.ts, deye-modbus-agent.mjs +1 |
| `day_grid_import_energy_kwh` | Imported Today | kWh | 76 | 30 | yes | Overview > Grid import / export | monitoring-content.tsx, solar-monitoring-view.tsx, today-so-far.tsx +7 |
| `day_grid_export_energy_kwh` | Exported Today | kWh | 77 | 30 | yes | Overview > Grid import / export | monitoring-content.tsx, solar-monitoring-view.tsx, today-so-far.tsx +7 |
| `total_grid_import_energy_kwh` | Imported Total | kWh | 78+80 | 30 | yes | Reports > From inverter | cadence-keys.ts, performance-metrics.ts, deye-modbus-agent.mjs |
| `grid_frequency_hz` | Frequency | Hz | 79 | 5 | yes | Monitoring > Per phase | monitoring-content.tsx, perf-sections.tsx, solar-monitoring-view.tsx +7 |
| `total_grid_export_energy_kwh` | Exported Total | kWh | 81+82 | 30 | yes | Reports > From inverter | cadence-keys.ts, performance-metrics.ts, deye-modbus-agent.mjs |
| `day_load_energy_kwh` | Consumption Today | kWh | 84 | 30 | yes | Overview > Today consumption | monitoring-content.tsx, solar-monitoring-view.tsx, today-so-far.tsx +9 |
| `total_load_energy_kwh` | Consumption Total | kWh | 85+86 | 30 | yes | Reports > From inverter | cadence-keys.ts, performance-metrics.ts, deye-modbus-agent.mjs +2 |
| `inverter_dc_temperature_c` | Heat-sink Temperature (DC) | °C | 90 | 30 | yes | Monitoring > Temperature | perf-sections.tsx, perf-solar.tsx, cadence-keys.ts +7 |
| `inverter_ac_temperature_c` | Heat-sink Temperature (AC) | °C | 91 | 30 | yes | Monitoring > Temperature | perf-sections.tsx, perf-solar.tsx, cadence-keys.ts +6 |
| `total_generator_energy_kwh` | Generator Energy Total | kWh | 92+95 | 30 | yes | Reports > From inverter | deye-modbus-agent.mjs |
| `generator_phase_error` | Generator Phase Check |  | 93 | 10 | NO | Maintenance > Wiring | maintenance-health.ts, deye-modbus-agent.mjs |
| `grid_phase_error` | Grid Phase Check |  | 93 | 10 | NO | Maintenance > Wiring | maintenance-health.ts, deye-modbus-agent.mjs |
| `total_pv_energy_kwh` | Solar Production Total | kWh | 96+97 | 30 | yes | Monitoring > Energy | monitoring-content.tsx, cadence-keys.ts, performance-metrics.ts +6 |
| `battery_communication_status` | Battery Communication |  | 100 | 10 | NO | Maintenance > Connection | deye-modbus-agent.mjs |
| `warning_message_1` | Warning Word 1 |  | 101 | 10 | yes | Maintenance > Inverter codes | deye-modbus-agent.mjs |
| `warning_message_2` | Warning Word 2 |  | 102 | 10 | yes | Maintenance > Inverter codes | deye-modbus-agent.mjs |
| `fault_message_1` | Fault Word 1 |  | 103 | 10 | yes | Maintenance > Inverter codes | cadence-keys.ts, device-alerts.ts, device-overview.ts +2 |
| `fault_message_2` | Fault Word 2 |  | 104 | 10 | yes | Maintenance > Inverter codes | cadence-keys.ts, device-alerts.ts, overview-keys.ts +1 |
| `fault_message_3` | Fault Word 3 |  | 105 | 10 | yes | Maintenance > Inverter codes | cadence-keys.ts, device-alerts.ts, overview-keys.ts +1 |
| `fault_message_4` | Fault Word 4 |  | 106 | 10 | yes | Maintenance > Inverter codes | cadence-keys.ts, device-alerts.ts, overview-keys.ts +1 |
| `battery_corrected_capacity_ah` | Corrected Capacity | Ah | 107 | 30 | yes | Performance > System | deye-modbus-agent.mjs |
| `day_pv_energy_kwh` | Production Today | kWh | 108 | 30 | yes | Overview > Today production | monitoring-content.tsx, solar-monitoring-view.tsx, today-so-far.tsx +9 |
| `pv1_voltage_v` | PV1 Voltage | V | 109 | 5 | yes | Monitoring > Per input (MPPT) | cadence-keys.ts, report-types.ts, deye-modbus-agent.mjs +3 |
| `pv1_current_a` | PV1 Current | A | 110 | 5 | yes | Monitoring > Per input (MPPT) | cadence-keys.ts, report-types.ts, deye-modbus-agent.mjs +3 |
| `pv2_voltage_v` | PV2 Voltage | V | 111 | 5 | yes | Monitoring > Per input (MPPT) | cadence-keys.ts, report-types.ts, deye-modbus-agent.mjs +3 |
| `pv2_current_a` | PV2 Current | A | 112 | 5 | yes | Monitoring > Per input (MPPT) | cadence-keys.ts, report-types.ts, deye-modbus-agent.mjs +3 |
| `alarm_status_1` | Alarm Status 1 |  | 117 | 10 | yes | Maintenance > Inverter codes | cadence-keys.ts, device-alerts.ts, device-overview.ts +2 |
| `alarm_status_2` | Alarm Status 2 |  | 118 | 10 | yes | Maintenance > Inverter codes | cadence-keys.ts, device-alerts.ts, overview-keys.ts +1 |
| `backup_ups_power_w` | Backup (UPS) Output Power | W | 119 | 5 | yes | Monitoring > AC output | deye-modbus-agent.mjs |
| `grid_l1_voltage_v` | Voltage L1 | V | 150 | 5 | yes | Monitoring > Per phase | monitoring-content.tsx, perf-sections.tsx, solar-monitoring-view.tsx +3 |
| `grid_relay_middle_voltage_v` | Relay Middle-side Voltage | V | 153 | 5 | yes | Monitoring > Per phase | deye-modbus-agent.mjs |
| `inverter_l1_voltage_v` | Output Voltage L1 | V | 154 | 5 | yes | Monitoring > AC output | monitoring-content.tsx, solar-monitoring-view.tsx, cadence-keys.ts +2 |
| `load_l1_voltage_v` | Voltage L1 | V | 157 | 5 | yes | Monitoring > Per phase | perf-sections.tsx, solar-monitoring-view.tsx, cadence-keys.ts +2 |
| `grid_l1_current_a` | Current L1 | A | 160 | 5 | yes | Monitoring > Per phase | monitoring-content.tsx, solar-monitoring-view.tsx, cadence-keys.ts +4 |
| `grid_ct_l1_current_a` | CT Current L1 | A | 162 | 5 | yes | Monitoring > Energy meter / CT | perf-sections.tsx, solar-monitoring-view.tsx, cadence-keys.ts +3 |
| `inverter_l1_current_a` | Output Current L1 | A | 164 | 5 | yes | Monitoring > AC output | monitoring-content.tsx, solar-monitoring-view.tsx, cadence-keys.ts +2 |
| `grid_l1_power_w` | Power L1 | W | 167 | 5 | yes | Monitoring > Per phase | deye-modbus-agent.mjs, 20260924000200_seed_deye_instrument_catalog.sql |
| `grid_total_power_w` | Grid Power Now | W | 169 | 5 | yes | Overview > Grid import / export | energy-today-cards.tsx, monitoring-content.tsx, overview-live.tsx +10 |
| `grid_ct_l1_power_w` | CT Power L1 | W | 170 | 5 | yes | Monitoring > Energy meter / CT | perf-sections.tsx, solar-monitoring-view.tsx, cadence-keys.ts +2 |
| `grid_ct_total_power_w` | CT Total Power | W | 172 | 5 | yes | Monitoring > Energy meter / CT | perf-sections.tsx, solar-monitoring-view.tsx, cadence-keys.ts +3 |
| `inverter_l1_power_w` | Output Power L1 | W | 173 | 5 | yes | Monitoring > AC output | phase-meter-card.tsx, cadence-keys.ts, template-fields.ts +1 |
| `inverter_output_power_w` | Output Power (Total) | W | 175 | 5 | yes | Monitoring > AC output | energy-today-cards.tsx, monitoring-content.tsx, perf-sections.tsx +11 |
| `load_l1_power_w` | Power L1 | W | 176 | 5 | yes | Monitoring > Per phase | monitoring-content.tsx, solar-monitoring-view.tsx, cadence-keys.ts +4 |
| `load_total_power_w` | Home Load Now | W | 178 | 5 | yes | Overview > Home load | energy-today-cards.tsx, monitoring-content.tsx, overview-live.tsx +9 |
| `load_l1_current_a` | Current L1 | A | 179 | 5 | yes | Monitoring > Per phase | solar-monitoring-view.tsx, cadence-keys.ts, report-types.ts +1 |
| `battery_temperature_c` | Battery Temperature | °C | 182 | 30 | yes | Monitoring > Live | perf-sections.tsx, solar-monitoring-view.tsx, cadence-keys.ts +6 |
| `battery_voltage_v` | Battery Voltage | V | 183 | 5 | yes | Monitoring > Live | device-settings.tsx, perf-sections.tsx, solar-monitoring-view.tsx +8 |
| `battery_soc_pct` | Battery Level | % | 184 | 5 | yes | Overview > Battery | registers-table.tsx, device-settings.tsx, monitoring-content.tsx +14 |
| `battery_charge_status` | Battery Charge Status |  | 185 | 5 | NO | Monitoring > Live | deye-modbus-agent.mjs |
| `pv1_power_w` | PV1 Power | W | 186 | 5 | yes | Monitoring > Per input (MPPT) | dashboard-header.tsx, cadence-keys.ts, cadence-parse.ts +6 |
| `pv2_power_w` | PV2 Power | W | 187 | 5 | yes | Monitoring > Per input (MPPT) | dashboard-header.tsx, cadence-keys.ts, report-types.ts +5 |
| `battery_power_w` | Battery Power | W | 190 | 5 | yes | Overview > Battery | energy-today-cards.tsx, monitoring-content.tsx, overview-live.tsx +11 |
| `battery_current_a` | Battery Current | A | 191 | 5 | yes | Monitoring > Live | solar-monitoring-view.tsx, cadence-keys.ts, performance-metrics.ts +4 |
| `load_frequency_hz` | Frequency | Hz | 192 | 5 | yes | Monitoring > Per phase | monitoring-content.tsx, perf-sections.tsx, solar-monitoring-view.tsx +5 |
| `inverter_output_frequency_hz` | Output Frequency | Hz | 193 | 5 | yes | Monitoring > AC output | monitoring-content.tsx, solar-monitoring-view.tsx, cadence-keys.ts +2 |
| `grid_relay_status` | Grid Connection |  | 194 | 5 | yes | Monitoring > Status | monitoring-content.tsx, solar-monitoring-view.tsx, deye-modbus-agent.mjs |
| `battery_type` | Battery Type |  | 200 | 300 | yes | Device & Settings > Configuration | deye-modbus-agent.mjs, 20260924000200_seed_deye_instrument_catalog.sql |
| `battery_capacity_ah` | Battery Capacity | Ah | 204 | 300 | yes | Device & Settings > Configuration | catalogue only |
| `battery_max_charge_current_a` | Max Charge Current | A | 210 | 300 | yes | Device & Settings > Configuration | catalogue only |
| `battery_max_discharge_current_a` | Max Discharge Current | A | 211 | 300 | yes | Device & Settings > Configuration | catalogue only |
| `battery_management_mode` | Battery Managed By |  | 213 | 300 | yes | Device & Settings > Configuration | catalogue only |
| `battery_shutdown_soc_pct` | Battery Shutdown Level | % | 217 | 300 | yes | Device & Settings > Configuration | catalogue only |
| `battery_restart_soc_pct` | Battery Restart Level | % | 218 | 300 | yes | Device & Settings > Configuration | catalogue only |
| `generator_port_function` | Generator Port Use |  | 235 | 300 | yes | Device & Settings > Configuration | catalogue only |
| `work_mode` | Work Mode |  | 244 | 300 | yes | Overview > Work mode | devices-board.tsx, setting-values.ts, 20260903020000_modbus_register_mapping.sql |
| `max_export_power_w` | Maximum Export Power | W | 245 | 300 | yes | Device & Settings > Configuration | catalogue only |
| `grid_frequency_setting` | Grid Frequency |  | 285 | 300 | yes | Device & Settings > Configuration | deye-modbus-agent.mjs, 20260924000000_add_site_engineer_role.sql, 20260924000200_seed_deye_instrument_catalog.sql |
| `grid_type` | Grid Type |  | 286 | 300 | yes | Device & Settings > Configuration | 20260928010000_correct_deye_v119_registers.sql |
| `bms_charge_voltage_v` | BMS Charge Voltage | V | 312 | 30 | yes | Monitoring > Battery management system (BMS) | perf-sections.tsx, cadence-keys.ts, performance-metrics.ts +3 |
| `bms_discharge_voltage_v` | BMS Discharge Voltage | V | 313 | 30 | yes | Monitoring > Battery management system (BMS) | deye-modbus-agent.mjs, 20260924000200_seed_deye_instrument_catalog.sql |
| `bms_charge_current_limit_a` | BMS Charge Current Limit | A | 314 | 30 | yes | Monitoring > Battery management system (BMS) | perf-sections.tsx, cadence-keys.ts, performance-metrics.ts +3 |
| `bms_discharge_current_limit_a` | BMS Discharge Current Limit | A | 315 | 30 | yes | Monitoring > Battery management system (BMS) | perf-sections.tsx, cadence-keys.ts, performance-metrics.ts +3 |
| `bms_soc_pct` | BMS State of Charge | % | 316 | 30 | yes | Monitoring > Battery management system (BMS) | deye-modbus-agent.mjs, 20260924000200_seed_deye_instrument_catalog.sql, 20260927000000_reconcile_solar_inverter_key_vocabulary.sql |
| `bms_voltage_v` | BMS Voltage | V | 317 | 30 | yes | Monitoring > Battery management system (BMS) | deye-modbus-agent.mjs, 20260924000200_seed_deye_instrument_catalog.sql |
| `bms_current_a` | BMS Current | A | 318 | 30 | yes | Monitoring > Battery management system (BMS) | deye-modbus-agent.mjs, 20260924000200_seed_deye_instrument_catalog.sql |
| `bms_temperature_c` | BMS Temperature | °C | 319 | 30 | yes | Monitoring > Battery management system (BMS) | perf-sections.tsx, cadence-keys.ts, performance-metrics.ts +1 |
| `bms_max_charge_current_limit_a` | BMS Max Charge Current Limit | A | 320 | 30 | yes | Monitoring > Battery management system (BMS) | deye-modbus-agent.mjs |
| `bms_max_discharge_current_limit_a` | BMS Max Discharge Current Limit | A | 321 | 30 | yes | Monitoring > Battery management system (BMS) | deye-modbus-agent.mjs |
| `battery_alarm` | Battery Alarm |  | 322 | 10 | yes | Maintenance > Battery | maintenance-health.ts, deye-modbus-agent.mjs |
| `battery_fault` | Battery Fault |  | 323 | 10 | yes | Maintenance > Battery | maintenance-health.ts, deye-modbus-agent.mjs |
| `battery_firmware_version` | Battery Firmware |  | 419+420 | 3600 | NO | Device & Settings > Inverter | device-about.ts |

### A3.2 Values the platform calculates or looks up (30 rows; no register)

| Key | Label | Source | How it is made | Used in | Code |
|---|---|---|---|---|---|
| `battery_model` | Battery Model | Record | Site record (stock/installation data), not read from the inverter. | Device & Settings > Site | catalogue only |
| `installed_pv_kwp` | Solar Capacity (kWp) | Record | Site record, not read from the inverter. | Device & Settings > Site | catalogue only |
| `active_alerts` | Active Alerts | Calculated | Derived by the platform — decodes warning words (101-102) and fault words (103-106) with the Deye W-/F-code table; no register of its own. | Maintenance > Active | catalogue only |
| `clock_out_of_sync` | Clock Out of Sync | Calculated | Derived: /inverter_date_time - now/ > 2 minutes. | Maintenance > Clock | maintenance-health.ts |
| `last_data_received_at` | Last Data Received | Calculated | Platform timestamp of the last successful read; no register. | Maintenance > Connection | catalogue only |
| `installation_date` | Installation Date | Record | Site / installation record. | Maintenance > Record | catalogue only |
| `next_service_date` | Next Service Due | Record | Site / service record. | Maintenance > Record | catalogue only |
| `settings_change_history` | Settings Change History | Calculated | Platform write log (equipment_configs). | Maintenance > Record | catalogue only |
| `warranty_end_date` | Warranty Valid Until | Record | Warranty record on the equipment row. | Maintenance > Record | actions.ts, actions.ts, page.tsx +3 |
| `inverter_overheat_warning` | Inverter Overheat | Calculated | Derived: heat-sink temperature above safe limit, or fault F64. | Maintenance > Temperature | maintenance-health.ts |
| `installation_date` | Installation Date | Record | Site / installation record. | Maintenance | catalogue only |
| `next_service_date` | Next Service Due | Record | Site / service record. | Maintenance | catalogue only |
| `warranty_end_date` | Warranty Valid Until | Record | Warranty record on the equipment row. | Maintenance | actions.ts, actions.ts, page.tsx +3 |
| `backup_time_remaining_h` | Backup Time Remaining | Calculated | Derived: (SOC - low-battery SOC) / 100 x capacity_ah x battery_voltage_v / load_total_power_w. No register. | Monitoring > Live | catalogue only |
| `battery_state` | Battery State | Calculated | Derived from battery_power_w sign and SOC (charging / discharging / idle). No register. | Monitoring > Live | catalogue only |
| `day_co2_saved_kg` | CO₂ Saved Today | Calculated | Derived: day_pv_energy_kwh x grid emission factor. No register. | Overview > CO₂ saved today | template-fields.ts |
| `pv_total_power_w` | Solar Production Now | Calculated | Derived: PV1 + PV2 + PV3 power (regs 186-188). No register of its own. | Overview > Live solar production | template-fields.ts |
| `day_self_use_pct` | Self Use Today | Calculated | Derived: (day_pv - day_grid_export) / day_pv x 100. No register. | Overview > Self use | template-fields.ts |
| `weather_condition` | Weather | Weather service | Weather API for the site location; no register. | Overview > Weather | catalogue only |
| `weather_temperature_c` | Outside Temperature | Weather service | Weather API for the site location; no register. | Overview > Weather | catalogue only |
| `pv_input_share_pct` | Share of Production per PV Input | Calculated | Derived: pvN_power_w / pv_total_power_w for each input. | Performance > MPPT | catalogue only |
| `self_consumption_pct` | Self Consumption | Calculated | Derived: (pv - grid export) / pv over the chosen period. | Performance > Ratios | template-fields.ts |
| `self_sufficiency_pct` | Self Sufficiency | Calculated | Derived: (load - grid import) / load over the chosen period. | Performance > Ratios | template-fields.ts |
| `battery_round_trip_efficiency_pct` | Round-trip Efficiency | Calculated | Derived: total_battery_discharge_energy_kwh / total_battery_charge_energy_kwh. No register. | Performance > System | template-fields.ts |
| `peak_pv_power_today_w` | Peak Solar Power Today | Calculated | Derived: highest pv_total_power_w since midnight. | Performance > Yield | catalogue only |
| `production_chart_24h` | Production Curve Today | Calculated | Derived series from stored pv_total_power_w polls. | Performance > Yield | catalogue only |
| `specific_yield_day_kwh_kwp` | Yield per kWp Today | Calculated | Derived: day_pv_energy_kwh / installed kWp. | Performance > Yield | catalogue only |
| `co2_saved_kg` | CO₂ Saved | Calculated | Derived from production and the grid emission factor. | Reports > Environment | template-fields.ts |
| `trees_equivalent` | Equivalent Trees Planted | Calculated | Derived: co2_saved_kg / kg CO2 per tree per year. | Reports > Environment | template-fields.ts |
| `savings_amount` | Savings | Calculated | Derived from load, import / export energy and tariffs. | Reports > Money | catalogue only |

### A3.3 Settings a customer can change (63 rows written to the inverter + 3 platform entries)

| Key | Label | Unit | Register | Source | Verified | Used in | Code |
|---|---|---|---|---|---|---|---|
| `inverter_date_time` | Inverter Date & Time |  | 22+23+24 | Modbus write + read-back | NO | Maintenance > Clock | deye-modbus-agent.mjs |
| `low_noise_mode_enabled` | Quiet Mode |  | 34 | Modbus write + read-back | yes | Device & Settings > Preferences | setting-values.ts |
| `battery_low_soc_pct` | Battery Low Level (Backup Reserve) | % | 219 | Modbus write + read-back | yes | Device & Settings > Energy mode | catalogue only |
| `generator_charge_start_voltage_v` | Start Generator Charging Below (Voltage) | V | 225 | Modbus write + read-back | yes | Device & Settings > Generator charging | catalogue only |
| `generator_charge_start_soc_pct` | Start Generator Charging Below | % | 226 | Modbus write + read-back | yes | Device & Settings > Generator charging | catalogue only |
| `generator_charge_current_a` | Generator Charging Current | A | 227 | Modbus write + read-back | yes | Device & Settings > Generator charging | catalogue only |
| `grid_charge_start_voltage_v` | Start Grid Charging Below (Voltage) | V | 228 | Modbus write + read-back | yes | Device & Settings > Grid charging | deye-modbus-agent.mjs, 20260924000200_seed_deye_instrument_catalog.sql |
| `grid_charge_start_soc_pct` | Start Grid Charging Below | % | 229 | Modbus write + read-back | yes | Device & Settings > Grid charging | deye-modbus-agent.mjs, 20260924000200_seed_deye_instrument_catalog.sql |
| `grid_charge_current_a` | Grid Charging Current | A | 230 | Modbus write + read-back | yes | Device & Settings > Grid charging | deye-modbus-agent.mjs, 20260903020000_modbus_register_mapping.sql, 20260924000200_seed_deye_instrument_catalog.sql |
| `generator_charge_enabled` | Charge Battery from Generator |  | 231 | Modbus write + read-back | yes | Device & Settings > Generator charging | device-settings.tsx |
| `grid_charge_enabled` | Charge Battery from Grid |  | 232 | Modbus write + read-back | yes | Device & Settings > Grid charging | device-settings.tsx, 20260903020000_modbus_register_mapping.sql, 20260924000200_seed_deye_instrument_catalog.sql |
| `smart_load_off_soc_pct` | Smart Load OFF at | % | 237 | Modbus write + read-back | yes | Device & Settings > Smart load | catalogue only |
| `smart_load_on_soc_pct` | Smart Load ON at | % | 239 | Modbus write + read-back | yes | Device & Settings > Smart load | catalogue only |
| `energy_priority_mode` | Energy Priority |  | 243 | Modbus write + read-back | yes | Device & Settings > Energy mode | setting-values.ts, 20260929000000_equipment_schema_rename.sql |
| `solar_sell_enabled` | Sell Solar to Grid |  | 247 | Modbus write + read-back | yes | Device & Settings > Energy mode | setting-values.ts, deye-modbus-agent.mjs, 20260924000200_seed_deye_instrument_catalog.sql |
| `time_of_use_enabled` | Time of Use |  | 248 | Modbus write + read-back | NO | Device & Settings > Time of Use | device-settings.tsx |
| `time_of_use_friday_enabled` | Time of Use on Friday |  | 248 | Modbus write + read-back | NO | Device & Settings > Time of Use | catalogue only |
| `time_of_use_monday_enabled` | Time of Use on Monday |  | 248 | Modbus write + read-back | NO | Device & Settings > Time of Use | catalogue only |
| `time_of_use_saturday_enabled` | Time of Use on Saturday |  | 248 | Modbus write + read-back | NO | Device & Settings > Time of Use | catalogue only |
| `time_of_use_sunday_enabled` | Time of Use on Sunday |  | 248 | Modbus write + read-back | NO | Device & Settings > Time of Use | catalogue only |
| `time_of_use_thursday_enabled` | Time of Use on Thursday |  | 248 | Modbus write + read-back | NO | Device & Settings > Time of Use | catalogue only |
| `time_of_use_tuesday_enabled` | Time of Use on Tuesday |  | 248 | Modbus write + read-back | NO | Device & Settings > Time of Use | catalogue only |
| `time_of_use_wednesday_enabled` | Time of Use on Wednesday |  | 248 | Modbus write + read-back | NO | Device & Settings > Time of Use | catalogue only |
| `time_of_use_slot1_start_time` | Slot 1 Start Time | HH:MM | 250 | Modbus write + read-back | yes | Device & Settings > Time of Use | 20260929000000_equipment_schema_rename.sql |
| `time_of_use_slot2_start_time` | Slot 2 Start Time | HH:MM | 251 | Modbus write + read-back | yes | Device & Settings > Time of Use | catalogue only |
| `time_of_use_slot3_start_time` | Slot 3 Start Time | HH:MM | 252 | Modbus write + read-back | yes | Device & Settings > Time of Use | catalogue only |
| `time_of_use_slot4_start_time` | Slot 4 Start Time | HH:MM | 253 | Modbus write + read-back | yes | Device & Settings > Time of Use | catalogue only |
| `time_of_use_slot5_start_time` | Slot 5 Start Time | HH:MM | 254 | Modbus write + read-back | yes | Device & Settings > Time of Use | catalogue only |
| `time_of_use_slot6_start_time` | Slot 6 Start Time | HH:MM | 255 | Modbus write + read-back | yes | Device & Settings > Time of Use | catalogue only |
| `time_of_use_slot1_power_w` | Slot 1 Battery Power | W | 256 | Modbus write + read-back | yes | Device & Settings > Time of Use | catalogue only |
| `time_of_use_slot2_power_w` | Slot 2 Battery Power | W | 257 | Modbus write + read-back | yes | Device & Settings > Time of Use | catalogue only |
| `time_of_use_slot3_power_w` | Slot 3 Battery Power | W | 258 | Modbus write + read-back | yes | Device & Settings > Time of Use | catalogue only |
| `time_of_use_slot4_power_w` | Slot 4 Battery Power | W | 259 | Modbus write + read-back | yes | Device & Settings > Time of Use | catalogue only |
| `time_of_use_slot5_power_w` | Slot 5 Battery Power | W | 260 | Modbus write + read-back | yes | Device & Settings > Time of Use | catalogue only |
| `time_of_use_slot6_power_w` | Slot 6 Battery Power | W | 261 | Modbus write + read-back | yes | Device & Settings > Time of Use | catalogue only |
| `time_of_use_slot1_battery_voltage_v` | Slot 1 Battery Voltage | V | 262 | Modbus write + read-back | yes | Device & Settings > Time of Use | catalogue only |
| `time_of_use_slot2_battery_voltage_v` | Slot 2 Battery Voltage | V | 263 | Modbus write + read-back | yes | Device & Settings > Time of Use | catalogue only |
| `time_of_use_slot3_battery_voltage_v` | Slot 3 Battery Voltage | V | 264 | Modbus write + read-back | yes | Device & Settings > Time of Use | catalogue only |
| `time_of_use_slot4_battery_voltage_v` | Slot 4 Battery Voltage | V | 265 | Modbus write + read-back | yes | Device & Settings > Time of Use | catalogue only |
| `time_of_use_slot5_battery_voltage_v` | Slot 5 Battery Voltage | V | 266 | Modbus write + read-back | yes | Device & Settings > Time of Use | catalogue only |
| `time_of_use_slot6_battery_voltage_v` | Slot 6 Battery Voltage | V | 267 | Modbus write + read-back | yes | Device & Settings > Time of Use | catalogue only |
| `time_of_use_slot1_battery_soc_pct` | Slot 1 Battery Level | % | 268 | Modbus write + read-back | yes | Device & Settings > Time of Use | catalogue only |
| `time_of_use_slot2_battery_soc_pct` | Slot 2 Battery Level | % | 269 | Modbus write + read-back | yes | Device & Settings > Time of Use | catalogue only |
| `time_of_use_slot3_battery_soc_pct` | Slot 3 Battery Level | % | 270 | Modbus write + read-back | yes | Device & Settings > Time of Use | catalogue only |
| `time_of_use_slot4_battery_soc_pct` | Slot 4 Battery Level | % | 271 | Modbus write + read-back | yes | Device & Settings > Time of Use | catalogue only |
| `time_of_use_slot5_battery_soc_pct` | Slot 5 Battery Level | % | 272 | Modbus write + read-back | yes | Device & Settings > Time of Use | catalogue only |
| `time_of_use_slot6_battery_soc_pct` | Slot 6 Battery Level | % | 273 | Modbus write + read-back | yes | Device & Settings > Time of Use | catalogue only |
| `time_of_use_slot1_generator_charge_enabled` | Slot 1 Charge from Generator |  | 274 | Modbus write + read-back | NO | Device & Settings > Time of Use | catalogue only |
| `time_of_use_slot1_grid_charge_enabled` | Slot 1 Charge from Grid |  | 274 | Modbus write + read-back | NO | Device & Settings > Time of Use | catalogue only |
| `time_of_use_slot2_generator_charge_enabled` | Slot 2 Charge from Generator |  | 275 | Modbus write + read-back | NO | Device & Settings > Time of Use | catalogue only |
| `time_of_use_slot2_grid_charge_enabled` | Slot 2 Charge from Grid |  | 275 | Modbus write + read-back | NO | Device & Settings > Time of Use | catalogue only |
| `time_of_use_slot3_generator_charge_enabled` | Slot 3 Charge from Generator |  | 276 | Modbus write + read-back | NO | Device & Settings > Time of Use | catalogue only |
| `time_of_use_slot3_grid_charge_enabled` | Slot 3 Charge from Grid |  | 276 | Modbus write + read-back | NO | Device & Settings > Time of Use | catalogue only |
| `time_of_use_slot4_generator_charge_enabled` | Slot 4 Charge from Generator |  | 277 | Modbus write + read-back | NO | Device & Settings > Time of Use | catalogue only |
| `time_of_use_slot4_grid_charge_enabled` | Slot 4 Charge from Grid |  | 277 | Modbus write + read-back | NO | Device & Settings > Time of Use | catalogue only |
| `time_of_use_slot5_generator_charge_enabled` | Slot 5 Charge from Generator |  | 278 | Modbus write + read-back | NO | Device & Settings > Time of Use | catalogue only |
| `time_of_use_slot5_grid_charge_enabled` | Slot 5 Charge from Grid |  | 278 | Modbus write + read-back | NO | Device & Settings > Time of Use | catalogue only |
| `time_of_use_slot6_generator_charge_enabled` | Slot 6 Charge from Generator |  | 279 | Modbus write + read-back | NO | Device & Settings > Time of Use | catalogue only |
| `time_of_use_slot6_grid_charge_enabled` | Slot 6 Charge from Grid |  | 279 | Modbus write + read-back | NO | Device & Settings > Time of Use | catalogue only |
| `grid_peak_shaving_enabled` | Limit Power from Grid |  | 280 | Modbus write + read-back | NO | Device & Settings > Grid peak shaving | catalogue only |
| `grid_peak_shaving_power_w` | Grid Power Limit | W | 293 | Modbus write + read-back | yes | Device & Settings > Grid peak shaving | deye-modbus-agent.mjs, 20260924000200_seed_deye_instrument_catalog.sql |
| `inverter_beep_enabled` | Inverter Beep |  | 330 | Modbus write + read-back | NO | Device & Settings > Preferences | catalogue only |
| `inverter_screen_auto_dim_enabled` | Screen Auto-dim |  | 330 | Modbus write + read-back | NO | Device & Settings > Preferences | catalogue only |
| `export_tariff_per_kwh` | Export Tariff | ₹/kWh | none | Platform entry (not the inverter) | n/a | Device & Settings > Account | catalogue only |
| `import_tariff_per_kwh` | Import Tariff | ₹/kWh | none | Platform entry (not the inverter) | n/a | Device & Settings > Account | catalogue only |
| `notifications` | Notifications (faults, power cut, battery low, offline) |  | none | Platform entry (not the inverter) | n/a | Device & Settings > Account | notification-center.tsx, report-builder-sheet.tsx, deye-fault-codes.ts +2 |

### A3.4 Actions (2)

* `raise_support_ticket`: Contact Support (Maintenance > Support)
* `report_download`: Download Report (Reports > Download)

### A3.5 The 29 customer-visible inverter values that are not verified (question O2)

Every one of them is a real inverter register; none is itself a calculated value. The column **Feeds calculated value** names any A3.2 value that is built from it (found by reading the catalogue notes), so you can see what else would be affected if a key turns out wrong.

| Key | Label | Source | Register | Cadence (s) | Used in | Code | What is unverified |
|---|---|---|---|---|---|---|---|
| `inverter_date_time` | Inverter Date & Time | Modbus write + read-back | 22+23+24 | 300 | Maintenance > Clock | `clock_out_of_sync` | deye-modbus-agent.mjs | Regs 22-24 system time (6 bytes: year since 2000, month, day, hour, minute, second). Write all three registers in one 0x10 request. |
| `generator_phase_error` | Generator Phase Check | Modbus read | 93 | 10 | Maintenance > Wiring | none | maintenance-health.ts, deye-modbus-agent.mjs | Reg 93 bit 2: 0 generator phase correct, 1 generator phase error. |
| `grid_phase_error` | Grid Phase Check | Modbus read | 93 | 10 | Maintenance > Wiring | none | maintenance-health.ts, deye-modbus-agent.mjs | Reg 93 bit 1: 0 grid phase correct, 1 grid phase error. |
| `battery_communication_status` | Battery Communication | Modbus read | 100 | 10 | Maintenance > Connection | none | deye-modbus-agent.mjs | Reg 100 test-flag bits: bit 8 = Li-ion RS485 link OK, bit 9 = Li-ion CAN link OK (1 = normal). |
| `battery_charge_status` | Battery Charge Status | Modbus read | 185 | 5 | Monitoring > Live | none | deye-modbus-agent.mjs | Reg 185 'battery status'. The PDF does not tabulate its values; no enum attached. |
| `time_of_use_enabled` | Time of Use | Modbus write + read-back | 248 | 300 | Device & Settings > Time of Use | none | device-settings.tsx | Reg 248 bit 0: time-of-use selling master enable. Shared with the weekday bits - read-modify-write. |
| `time_of_use_friday_enabled` | Time of Use on Friday | Modbus write + read-back | 248 | 300 | Device & Settings > Time of Use | none | catalogue only | Reg 248 bit 5: time-of-use enabled on friday. Shared register - read-modify-write. |
| `time_of_use_monday_enabled` | Time of Use on Monday | Modbus write + read-back | 248 | 300 | Device & Settings > Time of Use | none | catalogue only | Reg 248 bit 1: time-of-use enabled on monday. Shared register - read-modify-write. |
| `time_of_use_saturday_enabled` | Time of Use on Saturday | Modbus write + read-back | 248 | 300 | Device & Settings > Time of Use | none | catalogue only | Reg 248 bit 6: time-of-use enabled on saturday. Shared register - read-modify-write. |
| `time_of_use_sunday_enabled` | Time of Use on Sunday | Modbus write + read-back | 248 | 300 | Device & Settings > Time of Use | none | catalogue only | Reg 248 bit 7: time-of-use enabled on sunday. Shared register - read-modify-write. |
| `time_of_use_thursday_enabled` | Time of Use on Thursday | Modbus write + read-back | 248 | 300 | Device & Settings > Time of Use | none | catalogue only | Reg 248 bit 4: time-of-use enabled on thursday. Shared register - read-modify-write. |
| `time_of_use_tuesday_enabled` | Time of Use on Tuesday | Modbus write + read-back | 248 | 300 | Device & Settings > Time of Use | none | catalogue only | Reg 248 bit 2: time-of-use enabled on tuesday. Shared register - read-modify-write. |
| `time_of_use_wednesday_enabled` | Time of Use on Wednesday | Modbus write + read-back | 248 | 300 | Device & Settings > Time of Use | none | catalogue only | Reg 248 bit 3: time-of-use enabled on wednesday. Shared register - read-modify-write. |
| `time_of_use_slot1_generator_charge_enabled` | Slot 1 Charge from Generator | Modbus write + read-back | 274 | 300 | Device & Settings > Time of Use | none | catalogue only | Reg 274 bit 1: generator charge enable for time point 1. Shared register - read-modify-write. |
| `time_of_use_slot1_grid_charge_enabled` | Slot 1 Charge from Grid | Modbus write + read-back | 274 | 300 | Device & Settings > Time of Use | none | catalogue only | Reg 274 bit 0: grid charge enable for time point 1. Shared with generator-charge (bit 1) and GM/BU/CH mode bits - read-modify-write. |
| `time_of_use_slot2_generator_charge_enabled` | Slot 2 Charge from Generator | Modbus write + read-back | 275 | 300 | Device & Settings > Time of Use | none | catalogue only | Reg 275 bit 1: generator charge enable for time point 2. Shared register - read-modify-write. |
| `time_of_use_slot2_grid_charge_enabled` | Slot 2 Charge from Grid | Modbus write + read-back | 275 | 300 | Device & Settings > Time of Use | none | catalogue only | Reg 275 bit 0: grid charge enable for time point 2. Shared with generator-charge (bit 1) and GM/BU/CH mode bits - read-modify-write. |
| `time_of_use_slot3_generator_charge_enabled` | Slot 3 Charge from Generator | Modbus write + read-back | 276 | 300 | Device & Settings > Time of Use | none | catalogue only | Reg 276 bit 1: generator charge enable for time point 3. Shared register - read-modify-write. |
| `time_of_use_slot3_grid_charge_enabled` | Slot 3 Charge from Grid | Modbus write + read-back | 276 | 300 | Device & Settings > Time of Use | none | catalogue only | Reg 276 bit 0: grid charge enable for time point 3. Shared with generator-charge (bit 1) and GM/BU/CH mode bits - read-modify-write. |
| `time_of_use_slot4_generator_charge_enabled` | Slot 4 Charge from Generator | Modbus write + read-back | 277 | 300 | Device & Settings > Time of Use | none | catalogue only | Reg 277 bit 1: generator charge enable for time point 4. Shared register - read-modify-write. |
| `time_of_use_slot4_grid_charge_enabled` | Slot 4 Charge from Grid | Modbus write + read-back | 277 | 300 | Device & Settings > Time of Use | none | catalogue only | Reg 277 bit 0: grid charge enable for time point 4. Shared with generator-charge (bit 1) and GM/BU/CH mode bits - read-modify-write. |
| `time_of_use_slot5_generator_charge_enabled` | Slot 5 Charge from Generator | Modbus write + read-back | 278 | 300 | Device & Settings > Time of Use | none | catalogue only | Reg 278 bit 1: generator charge enable for time point 5. Shared register - read-modify-write. |
| `time_of_use_slot5_grid_charge_enabled` | Slot 5 Charge from Grid | Modbus write + read-back | 278 | 300 | Device & Settings > Time of Use | none | catalogue only | Reg 278 bit 0: grid charge enable for time point 5. Shared with generator-charge (bit 1) and GM/BU/CH mode bits - read-modify-write. |
| `time_of_use_slot6_generator_charge_enabled` | Slot 6 Charge from Generator | Modbus write + read-back | 279 | 300 | Device & Settings > Time of Use | none | catalogue only | Reg 279 bit 1: generator charge enable for time point 6. Shared register - read-modify-write. |
| `time_of_use_slot6_grid_charge_enabled` | Slot 6 Charge from Grid | Modbus write + read-back | 279 | 300 | Device & Settings > Time of Use | none | catalogue only | Reg 279 bit 0: grid charge enable for time point 6. Shared with generator-charge (bit 1) and GM/BU/CH mode bits - read-modify-write. |
| `grid_peak_shaving_enabled` | Limit Power from Grid | Modbus write + read-back | 280 | 300 | Device & Settings > Grid peak shaving | none | catalogue only | Reg 280 bits 8-11: 0 grid peak-shaving disabled, 1 enabled. Shared register - read-modify-write, keep the other bits unchanged. |
| `inverter_beep_enabled` | Inverter Beep | Modbus write + read-back | 330 | 300 | Device & Settings > Preferences | none | catalogue only | Reg 330 bits 2-3 (communication board): 11 = on, 10 = off, 00/01 = no action. Shared register - keep the other bits unchanged. |
| `inverter_screen_auto_dim_enabled` | Screen Auto-dim | Modbus write + read-back | 330 | 300 | Device & Settings > Preferences | none | catalogue only | Reg 330 bits 6-7 (communication board): 11 = on, 10 = off, 00/01 = no action. Shared register - keep the other bits unchanged. |
| `battery_firmware_version` | Battery Firmware | Modbus read | 419+420 | 3600 | Device & Settings > Inverter | none | device-about.ts | Regs 419 (low) / 420 (high) lithium version number; for parallel batteries only the last unit is readable. |
