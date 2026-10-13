# WayTara gateway: ESP32-S3 to inverter, MQTT, backend and Supabase

A plan, not code. Written 2026-10-12 from what is in this repo, the Python agent, the ESP32 sketches and the Deye documents on this PC, plus internet research (sources at the end).
Companion file: [DEYE_8K_REGISTER_DECODE.md](DEYE_8K_REGISTER_DECODE.md) (every register of the Deye 8K at Waytara Office, its decode formula, and what is not yet proven).

Legend: **[verified]** I read it in a file or a vendor page. **[inferred]** my conclusion from verified facts. **[spike]** must be proven with a short test before we build on it.

---

## 0. The answer on one page

| Question | Decision |
|---|---|
| What reads the inverter? | An ESP32-S3 gateway on the inverter's **Modbus RJ45 port 8** (RS485, 9600 8N1, slave 1) **[verified]**. It reads **raw 16-bit words** and does no decoding. |
| Who decodes? | **Only the backend.** Rules come from `equipment_metrics` (the same rows the Python agent uses today). |
| How does data travel? | ESP32 → **MQTT over TLS** → broker → **Node/Express backend** → Supabase. Browsers never talk to the broker or to the ESP32. |
| Which broker, on Render **free**? | Render cannot expose raw MQTT (TCP 1883/8883) to the internet, only HTTP(S) and WebSocket **[verified]**, and a free workspace has **750 instance hours a month** (one always-on service uses about 744) and **no inbound private networking** **[verified: Render free-tier page]**. So on the free plan there is **one service**: the backend with an **embedded MQTT broker (Aedes) served over WSS on 443**. Gateways' MQTT keep-alive messages are WebSocket traffic, which keeps the free service from spinning down **[verified: WebSocket messages count as traffic]**. Later (paid or your own server) the broker moves out to Mosquitto with plain MQTTS; the topics and firmware stay the same. **[spike: 72 h with a real gateway]** |
| Supabase without a service key? | Yes. **Phase 1 (Render free):** the backend signs in as a dedicated **service user** in Supabase Auth; every `gw_*` function and the Storage policy checks that user id; no key that bypasses RLS exists anywhere. **Later (paid/own server):** a dedicated **Postgres role** (`waytara_gateway`) that can only run those functions through the session pooler. The ESP32 holds **no Supabase credential at all**. **[spikes below]** |
| Unique key / WebSocket per equipment? | Yes: **admin-created, admin-managed equipment keys**, each bound to one equipment and one channel (MQTT signing and/or a dedicated WebSocket), shown once, rotatable, revocable, with scopes, expiry, rate limits and a usage log. Section 5.3. |
| Who may choose the customer and device? | **Only an admin or installer, in the admin web app**, never on the ESP32's own page. The gateway shows a claim code; the admin claims it server-side. |
| Go Live? | Browser ↔ backend **secure WebSocket**, signed in with the user's Supabase token. The backend asks the gateway to poll fast, and stops when the tab closes or goes quiet. |
| EV chargers? | The backend is the **OCPP central system**: chargers connect to `wss://…/ocpp/{chargePointId}` (OCPP 1.6-J; your Plugzmart 7.4 kW AC charger `WT_PZ_7k_1` already speaks it). The backend checks every message, decodes meter values **using the unit in the message**, stores raw frames (30 days), readings (same pipeline as the inverter) and an authoritative **`ev_transactions`** table. Section 7.8. First thing to prove: the charger can use `wss://` with Basic auth. |
| Writes? | App → backend (checked) → MQTT command (signed, expiring) → ESP32 writes → **reads back** → backend records what the inverter holds → Supabase Realtime updates the app. |
| 30 days? | The ESP32 buffer, the backend's data and the backend's logs keep **30 days**, compressed daily. **Render free has no persistent disk and may restart a service at any time** **[verified]**, so on the free plan the backend's local files are only a **cache**; the durable 30-day copy is a daily gzip uploaded to a private **Supabase Storage** bucket and purged after 30 days. A paid Render disk later makes the local files the durable copy. Supabase's 15-minute roll-ups stay at **8 days** as you decided; hourly and daily roll-ups are unchanged. |
| False data? | Every value carries a quality flag. No answer is stored as "no data", never as 0. Section 10. |

**Settled (2026-10-13):** board = **Waveshare ESP32-S3-RS485-CAN**; hosting = **Render free plan for now**; Supabase 15-minute roll-ups = **8 days**. What is still open is in section 14.

---

## 1. What exists today (facts)

* **Inverter:** Deye SUN-8K-SG05LP1-EU-AM2-P at Waytara Office. The "Modbus" RJ45 (port 8) carries RS485 on pins 1 = B, 2 = A, 3 = GND (8, 7, 6 duplicate them). Port 7 "RS 485/METER" and port 6 "BMS 485/CAN" look the same and are **not** the port to use. 9600 baud, 8N1, slave id 1 (LCD: Advanced Function, "Modbus SN" 01, which your photo confirms). **[verified: your Deye guide and photos]**
* **Today's chain:** inverter → RS485 → Waveshare RS485-to-PoE-Ethernet bridge → PC running the Python `equipment_agent` → Supabase. The PC is the single point of failure. **[verified]**
* **Where decoding happens today:** in the Python agent (`equipment_agent/codec.py`), using `equipment_metrics.address` and `.decode`. Supabase stores **already decoded** numbers; the web app only formats them. The fault-code wording lives in `apps/web/src/lib/deye-fault-codes.ts`. **[verified]** The ESP32 plan moves decoding into the backend and keeps the same rules.
* **Catalogue for this inverter:** 375 read metrics with registers (388 distinct registers), 31 derived read metrics, 63 write metrics with registers, 3 platform-only settings. **[verified, live DB]**
* **Supabase today:** `ingest_tick()` (service role only) writes `equipment_latest`, `equipment_open_bucket`, `equipment_rollup_15m` and `equipment_heartbeat`; the status verdict (online / device_unreachable / offline / never_seen) is computed in the database; dashboards read the roll-ups; settings are the append-only `equipment_configs` log. Another session added `equipment_ingest_tokens` and `ingest_device_tick()` so a device can report with the anon key plus a secret token. **[verified]**
* **ESP32 code that exists:** three Arduino sketches in `D:\Manoj-Waytara\esp32 scripts\` (`wifi_manager`, `connect_wifi_script`, `supabase_push`): serial-console Wi-Fi setup with credentials in `Preferences`, and a **direct** push to Supabase every 60 s. `supabase_push.ino` contains a device token in plain text; **rotate that token** when this plan replaces it. **[verified]**
* **EV:** a local OCPP 1.6J server exists in `D:\Manoj-Waytara\EV Web Socket\`. EV chargers speak OCPP over WebSocket and connect **directly** to the backend (section 7.8), not through the ESP32.

---

## 2. Target architecture

```
   site                                   Render (one free service)                         Supabase
 ┌───────────┐ RS485 ┌──────────────┐ MQTT over WSS  ┌─────────────────────────────────┐
 │ Deye 8K   │◄─────►│ ESP32-S3     │◄──────────────►│ waytara-server (Node + Express) │   service user
 │ generator │Modbus │ RS485-CAN    │  443, key per  │  - embedded MQTT broker (Aedes) │  ─────────────►  Postgres (gw_* functions)
 │ UPS       │  RTU  │ raw words    │  equipment     │  - auth, RBAC, equipment keys   │  ─────────────►  Storage (hourly archive)
 └───────────┘       │ buffer,      │                │  - decode, validate, quality    │
                     │ signed cmds  │                │  - files (cache), Go Live WS    │ ◄──────────────  Auth (JWT/JWKS), Realtime
                     └──────────────┘                │  - command pipeline             │
 ┌───────────┐ OCPP 1.6-J over wss  (Basic auth =   │  - OCPP central system (CSMS)   │
 │ EV charger│◄────────────────────  equipment key)►│    /ocpp/{chargePointId}        │
 │ Plugzmart │                                      └───────────────▲─────────────────┘
 └───────────┘                                                      │ HTTPS + WSS (user's Supabase token)
   unclaimed gateway shows a claim code ─ admin app claims it ─────►│
                                    customer / installer / admin browsers (Go Live, commands, admin Keys tab)
```

**Responsibilities (the rule that keeps data honest):**

| Part | Does | Never does |
|---|---|---|
| ESP32 | Wi-Fi/4G, time (SNTP), Modbus reads/writes, local ring buffer, heartbeat, obey signed commands | decode, hold Supabase keys, choose the customer, decide what a value means |
| Broker (embedded for now) | carry messages, enforce per-device topic ACL, last-will | store anything we depend on (it forgets on every restart) |
| Backend | authenticate everything, decode, range-check, quality-flag, write files and Supabase, run commands, serve Go Live, act as the OCPP central system for chargers | trust a device-supplied customer/equipment id, hold a service key |
| Supabase | system of record, RLS for people, enums, Realtime to apps, the 30-day archive | accept writes from anything but the backend's service user (through the `gw_*` functions) and signed-in users under RLS |
| Admin app | claim wizard, fleet health, logs, remote actions | |
| Customer app | view, Go Live, change allowed settings | see another customer's data |

---

## 3. Hardware and wiring

**Board.** The best match is the **Waveshare ESP32-S3-RS485-CAN**: ESP32-S3 (dual-core 240 MHz), 2.4 GHz Wi-Fi and BLE 5, **isolated RS485** with automatic direction control, a built-in RS485 termination resistor, CAN, 7 to 36 V DC input, USB-C, 16 MB flash, an RTC battery header, DIN-rail case **[verified: Waveshare product page]**. **This is the board you chose.** Its RS485 port is wired to the module's UART with automatic direction control, so the firmware uses the UART driver in RS485 half-duplex mode and needs no external transceiver; the exact GPIO numbers come from Waveshare's wiki (I did not find them in the product pages). The CAN port is not used (the inverter's CAN is for a lithium battery's BMS, which is not our concern). The board has **no SIM slot**, so cellular means a 4G router or MiFi on Wi-Fi first (option 1 below).

**Wiring to the Deye (port 8).** Inverter pin 1 (B) to the board's RS485 B, pin 2 (A) to A, pin 3 (GND) to the isolated GND. If there is no answer, swap A and B first (the most common fault). Add the 120 Ω termination only if errors appear on a long run. Keep this cable away from the AC wiring. **[verified: your guide; the A/B swap is the standard first check]**

**Power.** Feed the board from a supply that **survives a grid cut** (inverter-backed socket or a small DC supply on the battery side), otherwise the gateway dies exactly when the customer most wants to know what happened. A power cut then shows as a gap. Section 4.6 explains how the gateway still reports "I rebooted after a power loss".

**Several devices on one bus.** Inverter, generator controller and UPS can share the RS485 bus if each has its own slave id and the same baud/parity. The gateway keeps a **device profile per slave id** (which register map, which cadence). A UPS or generator controller that is not Modbus RTU needs its own adapter (USB, SNMP, vendor protocol): out of scope for the first release; the profile model leaves room for it.

**SIM / cellular.** The ESP32-S3 has no cellular radio. Options, easiest first:
1. **A 4G Wi-Fi router or MiFi** at the site: the gateway just sees Wi-Fi. No firmware work. Recommended first.
2. A **4G module on a UART** (SIM7670G / A7670E class, driven with ESP-IDF's `esp_modem` PPP). Waveshare also sells a combined **ESP32-S3-SIM7670G-4G** board (LTE Cat-1, GNSS) **[verified]**, but it has no isolated RS485 in the listing, so it would need an RS485 module. Later phase.
3. Ethernet (PoE) where the site has a cable.

The firmware network manager prefers Wi-Fi and fails over to the other path after N minutes of no internet.

---

## 4. ESP32 firmware (folder: `D:\Manoj-Waytara\esp32 scripts\waytara-gateway\`)

**Framework.** ESP-IDF 5.x (C/C++, PlatformIO or `idf.py`). Reason: secure boot, flash and NVS encryption, OTA with rollback, `esp-modbus`, `esp-mqtt` with TLS, `esp_modem` and unified provisioning are native there **[verified: Espressif docs]**. The existing Arduino sketches stay as prototypes. If you want a faster first proof, a Phase 0 Arduino RS485 read of the serial-number registers is a one-day job.

### 4.1 Boot sequence (the "start-up service")

```
power-on / reset
 1. record reset reason (power-on, brownout, watchdog, software, panic) and uptime counter
 2. self-test: NVS readable, config valid, clock (RTC), RS485 UART up, LEDs
 3. load config (encrypted NVS): networks, gateway id, broker URL, credentials, poll plan version
 4. network: try saved Wi-Fi networks (last good first) → else 4G/ethernet → else setup mode
 5. time: SNTP (several servers); mark time quality 0 until synced
 6. internet checks: DNS, TLS to backend, reachability; measure latency and a small throughput test
 7. MQTT connect (wss), set last-will "offline", publish retained "online" + boot event
 8. state:
      unclaimed → publish claim request, show claim code, keep setup page open
      claimed   → fetch/confirm config (poll plan), start the Modbus engine
 9. RS485 link probe: read the identity registers (serial R3 to R7, device type, rated power)
      compare with the equipment the admin chose → mismatch = LINK_REFUSED, no data is sent
10. steady state: poll, buffer, publish, heartbeat, listen for commands
```

A **status page** (and an LED pattern) shows steps 1 to 9 as a checklist: power, Wi-Fi, internet, time, backend, MQTT, RS485 bus, inverter link, claim state, config version. This is the "check the connections at the start" you asked for.

### 4.2 Wi-Fi, scan, "range" and "speed"

* **Credentials** are stored in encrypted NVS: up to five networks with a priority; the last good one is tried first; after N failures the gateway opens the setup AP; a long press on the board's button forgets everything (unclaim + factory reset).
* **Nearby networks:** `esp_wifi_scan_start()` returns SSID, **RSSI**, channel and security; the page shows signal bars. As a starting rule of thumb (not an Espressif figure): better than −60 dBm good, −60 to −70 usable, weaker than about −75 unreliable **[inferred, tune on site]**. Scanning while the setup AP is up can hide the AP from phones, so scan on demand and a few seconds after the AP starts **[verified: community component notes]**.
* **"Speed":** the page runs a **network check against the backend** (`GET /v1/netcheck`, `POST /v1/netcheck`): latency (median of 10), download and upload of a small payload, and reports kbit/s. The gateway's real need is tiny (a few kbit/s), so what matters is **latency and stability**, not Mbit/s. The ESP32-S3 Wi-Fi is 2.4 GHz only.
* **Bluetooth nearby:** a BLE scan can list nearby devices with RSSI for the installer; BLE is used for **provisioning**, not for data. Web Bluetooth works in Chrome, Edge and Samsung Internet and **not** in Safari or Firefox; on iPhone an installer would use a native app or the claim-code route below **[verified: third-party compatibility notes]**.

### 4.3 The setup GUI on the gateway (what it may and may not do)

Served by the gateway in setup mode over its own access point (`WayTara-Setup-XXXX`, WPA2 with a **per-device key printed on the label**) with a captive portal.

| It can | It cannot |
|---|---|
| show the checklist, scan Wi-Fi, connect, save networks, run the speed check, show the **claim code** and the firmware version | pick a customer or device, show customer data, hold admin credentials, change the poll plan |

Changes on this page also need the **setup PIN** from the label. **Selecting the customer and device happens in the admin app (section 5)**, so "only the admin" is enforced by Supabase Auth on the server, not by hiding a page on a device anyone in Wi-Fi range could reach.

### 4.4 Modbus engine

* Reads in **contiguous blocks** (≤ 60 registers, small gaps allowed) following the **poll plan** the backend sends. Slave ids, baud and parity come from the plan.
* **Bus scheduler:** one transaction at a time; round-robin by due time; **Live mode preempts** (section 7.6); writes jump the queue but never interrupt a transaction.
* **Time budget.** From the catalogue: 388 registers in 32 blocks; a full pass ≈ 3.5 s, the "every 5 s" tier (37 registers) ≈ 0.4 s, the "every 10 s" tier ≈ 1.5 s (my estimate at 9600 baud with ~60 ms inverter turnaround) **[inferred; measure on the real unit]**. So **a full 1-second sweep of everything is not possible; a 1-second Live view of about 15 key values is.**
* On error: retry once, then record the Modbus exception or timeout **as a result**, not as a value. After 3 failed passes the gateway reports `inverter_unreachable` (the gateway itself is fine).
* **Never write** a register that is not on the **write allow-list** in the signed config, and never one on the firmware's hard deny-list (grid standard, factory reset, protection limits), whatever the backend says.

### 4.5 Buffer and 30-day rule on the ESP32

The ESP32 cannot keep 30 days of readings and does not need to. It keeps a **ring buffer of unsent batches** (RAM first, LittleFS on the 16 MB flash) for outages, **at most 48 hours**, oldest dropped first, each batch with a sequence number so the backend can fill the gap and ignore duplicates. Nothing older than 30 days is ever kept; the buffer is smaller than that by design. Logs on the device are a small rotating file (last boot reasons and errors), not history.

### 4.6 Heartbeat and the "is it on?" questions

* MQTT **keepalive 30 s** and a **heartbeat message every 15 s** with: uptime, reset reason (first message after boot), Wi-Fi RSSI and channel, link type, free heap, time quality, **age of the last good Modbus read**, consecutive Modbus failures, buffer depth.
* **Last-will** (set at connect): the broker publishes `offline` if the gateway disappears without saying goodbye. A clean shutdown publishes `offline` itself. Status is a **retained** message, so a new subscriber sees the current state at once **[verified: standard MQTT status pattern]**.
* **What the cloud can tell apart:**

| Situation | What the backend sees | Verdict |
|---|---|---|
| Everything fine | heartbeats + good reads | `online` |
| Inverter off or RS485 broken | heartbeats continue, Modbus fails ≥ 3 passes | `device_unreachable` (the existing status) |
| Gateway off, **or** site internet down | heartbeats stop, last-will fires | `offline` |
| Gateway lost power and came back | first message says reset reason **power-on or brownout** and uptime restarted | "power loss" event with the gap length |

  "Gateway off" and "internet down" look the same from the cloud; the reset reason on reconnect is what separates a **power cut** from a **network cut**. The verdict wording stays the one the dashboard already uses.

### 4.7 OTA and device security

* **OTA** with rollback: new image downloads to the spare slot, boots, and is marked valid only after it has connected and completed a Modbus pass; otherwise the bootloader rolls back **[verified: ESP-IDF OTA docs]**. Rollback must be enabled in the **first** flash. Images are signed.
* **Production units:** flash encryption (release mode, a unique key per device), secure boot v2, NVS encryption, JTAG off, UART download locked **[verified: Espressif security overview]**. These eFuse settings are irreversible, so develop on spare boards and lock the production units only after the firmware is proven.
* **Secrets on the device:** the per-device broker credential and a per-device command-signing key in encrypted NVS, nothing else. No Supabase anon key, no service key, no device token for Supabase.

---

## 5. Commissioning and roles (the customer / installer / admin / user flows)

### 5.1 Who can do what

| Capability | Customer owner | Customer user (family, staff) | Installer (`site_engineer`) | Employee | Admin |
|---|---|---|---|---|---|
| See own dashboard, Go Live | yes | yes (own site) | assigned sites | all | all |
| Change settings marked `show_for_user` (plan permitting) | yes | owner may allow | yes | yes | yes |
| Change installer-level settings | no | no | assigned sites | yes | yes |
| Claim a gateway, choose customer and device | no | no | **yes, assigned sites** | yes | **yes** |
| Edit property type, power source, package | no | no | no | yes | yes |
| See gateway health, logs, remote reboot/OTA | no | no | assigned | yes | yes |
| Revoke a gateway, rotate credentials | no | no | no | no | **yes** |

"Customer user" is a new, optional role under a customer; it does not exist yet and can wait.

### 5.2 Claim flow (the part that makes it "admin only")

1. Installer powers the gateway. It is **unclaimed**: it joins Wi-Fi (setup page or BLE), connects to the broker with its **factory identity** (a per-device credential created at manufacturing), and may only talk on the `bootstrap` topics.
2. The gateway shows a **claim code** (6 to 8 characters, from its id, rotating) on its page and by LED pattern, and publishes a claim request.
3. In the **admin app → Gateways → Unclaimed**, the signed-in admin or installer sees the gateway with firmware, signal strength and time online, and starts the **claim wizard**: customer → site → equipment (Deye 8K) → device profile (which metric template) → bus settings (baud, parity, slave id) → read cadence and Supabase push cadence → write permissions.
4. The backend checks the user's role, creates the gateway row, issues the **real credentials** (new broker user and ACL, a command-signing key), and sends the signed config to the gateway over the bootstrap topic.
5. The gateway runs the **link probe**: it reads the inverter's serial number and type and sends them; the backend compares with the equipment record. **Mismatch = refuse and show why** (wrong inverter, wrong slave id, wrong register map). Match = `active`.
6. Everything is written to `audit_log`. The setup access point closes after claim.

If the gateway is stolen or sold, an admin revokes it: its broker user is deleted, its key is dead, and a factory reset needs the physical button.

### 5.3 Equipment keys and per-equipment channels (admin-managed)

**What it is.** For every piece of equipment an admin can create one or more named **equipment keys**. A key is a public key id plus a secret that is **shown once**. It proves "this client speaks for **this equipment**" and opens that equipment's channel only. Each equipment has two kinds of channel:

| Channel | Used by | How the key is used |
|---|---|---|
| **MQTT channel** (topics `wt/v1/gw/{gw}/eq/{equipmentId}/…`) | the ESP32 gateway; one gateway can serve several equipment on one RS485 bus (inverter, generator controller, UPS) | the gateway connects once with its own transport credential (section 6); the **equipment key signs every data batch and checks every command** (HMAC-SHA256). The broker ACL lists exactly the equipment ids this gateway serves, so a batch signed with another equipment's key, or for an equipment it does not serve, is dropped |
| **WebSocket channel** (`wss://…/v1/ws/eq/{equipmentId}`, and `/ocpp/{equipmentId}` for chargers) | devices that cannot use MQTT: EV chargers (OCPP 1.6J), a PC agent, a vendor adapter | the key **is** the login: `Authorization: Bearer wtk_…` on the upgrade request (or the first message). Never in the URL, because URLs reach logs. One writer connection per key by default |

**Viewers never use equipment keys.** Customers and staff watching a dashboard or Go Live sign in with their own Supabase login. So a leaked equipment key can push data for that one equipment (inside its scopes) and cannot read anything, and a customer login cannot push data.

**What the admin can do** (admin app → Equipment → **Keys** tab; **admin only**, with a fresh sign-in or MFA check before creating, rotating or revoking):

* **Create:** label, channel (MQTT signing, WebSocket, or both), **scopes** (`data:write`, `cmd:receive`, `live:serve`), expiry (default 365 days), optional IP allow-list, rate limits (messages and bytes per minute), max simultaneous sessions (default 1). The secret appears **once** (copy, `.env` download, or a QR for the setup page). Afterwards only the prefix (`wtk_live_k3f9…`) and the dates show.
* **Rotate:** makes a new secret. The old one stays valid for an overlap (default 24 h, up to 7 days) or until the new one has been used successfully, then retires itself. A gateway receives its new signing key on the signed `cfg` topic and acknowledges it.
* **Suspend / resume** and **revoke now.** Revoke closes live sessions and removes the key from the broker's allow-list **within seconds** (verification results are cached for at most 15 s and a revoke event clears the cache at once).
* **Usage:** last seen, source IP and country, sessions, messages per hour, rejected attempts, signature failures, and a download of the audit trail.
* **Alerts to the admin:** auth failures spike, use from a new IP, rate-limit hits, key expiring in 14 days.
* **Delete** only after a revoke plus 30 days; creation, rotation and revocation stay in `audit_log` permanently.

**Key format and storage.** `wtk_<env>_<keyId>_<secret>`: `keyId` is 8 hex characters (public, shown in lists and logs), `secret` is 32 random bytes in base64url. The prefix `wtk_` makes a leaked key easy to find with secret scanning. The database stores only `SHA-256(secret + server pepper)` (the secret is high-entropy, so a slow hash adds nothing; the pepper lives in the backend's environment) and compares in constant time. The secret is generated **inside Postgres** (`gen_random_bytes`), returned once to the admin's session, never logged (log redaction is a test), never stored in plain text.

**Where the checks run.** The backend verifies a key at the moment of connection (Aedes `authenticate`, the WebSocket upgrade handler) and again for each signed message; results are cached for 15 s. A revoked or expired key, a wrong equipment id, an IP outside the allow-list, a second session over the limit, or a rate over the limit is refused and written to `equipment_key_events`. Five bad attempts in a minute from one IP suspends that key's source for 10 minutes.

```sql
create type waytara.key_channel as enum ('mqtt_signing','websocket','both');
create type waytara.key_status  as enum ('active','pending','suspended','revoked','expired');

equipment_keys       (id uuid pk, equipment_id uuid fk, key_id text unique, label text, channel key_channel,
                      scopes text[], secret_hash bytea, status key_status, expires_at timestamptz,
                      ip_allow cidr[], max_sessions int default 1, rate_msgs_per_min int default 120,
                      rotated_from uuid, retire_old_at timestamptz, created_by uuid, created_at timestamptz,
                      last_used_at timestamptz, last_ip inet, use_count bigint)
equipment_key_events (id, key_id, ts, kind text,   -- created, rotated, revoked, auth_ok, auth_fail, ip_change, rate_limited, sig_fail
                      ip inet, detail jsonb)        -- 30 days; lifecycle events also go to audit_log forever
-- admin-only functions, called with the admin's own JWT; each checks profiles.role = 'admin' and writes audit_log:
--   admin_create_equipment_key(equipment_id, label, channel, scopes, expires_at, ip_allow, ...) -> (key_id, secret)  -- secret returned once
--   admin_rotate_equipment_key(key_id, overlap) / admin_revoke_equipment_key(key_id) / admin_suspend_equipment_key(key_id)
-- gateway-side function, callable only by the backend identity:
--   gw_verify_equipment_key(key_id, secret_hash) -> (equipment_id, scopes, channel, status)
```

This **replaces** `equipment_ingest_tokens` and `ingest_device_tick()` (the earlier per-device token that lets a device report with the anon key). Migrate, then drop them, and rotate the token written in `supabase_push.ino`.

---

## 6. MQTT contract

**Broker:** WSS on 443 (Render) now; MQTTS 8883 on a server you host later. Clean sessions off for gateways so queued commands survive a short drop (QoS 1). ESP-IDF's `esp-mqtt` supports `mqtts`, `ws` and `wss` and has last-will and auto-reconnect built in **[verified]**.

**Topics** (`{gw}` = gateway id, never the customer id; the broker ACL pins each device to its own `{gw}`):

| Direction | Topic | QoS | Retained | Content |
|---|---|---|---|---|
| up | `wt/v1/gw/{gw}/status` | 1 | **yes** | `online` / `offline` (last-will) |
| up | `wt/v1/gw/{gw}/hb` | 0 | no | heartbeat (4.6) |
| up | `wt/v1/gw/{gw}/data` | 1 | no | **raw** register batches (below) |
| up | `wt/v1/gw/{gw}/evt` | 1 | no | boot, reset reason, Wi-Fi changed, link up/down, OTA result |
| up | `wt/v1/gw/{gw}/ack/{cmdId}` | 1 | no | command result with the **read-back** value |
| up | `wt/v1/gw/{gw}/diag` | 0 | no | Wi-Fi scan, net check (on request) |
| up | `wt/v1/boot/{hwId}/claim` | 1 | no | unclaimed gateways only |
| down | `wt/v1/gw/{gw}/cfg` | 1 | **yes** | poll plan, cadences, write allow-list, version, signature |
| down | `wt/v1/gw/{gw}/cmd/{cmdId}` | 1 | no | signed command |
| down | `wt/v1/gw/{gw}/live` | 1 | no | `start` / `keepalive` / `stop` with the key list and 1 s rate |
| down | `wt/v1/gw/{gw}/sys` | 1 | no | reboot, rescan, OTA url+hash |

**Envelope on every message:** `{ "v":1, "gw":"…", "seq":123456, "ts":1791800000123, "tq":1, … }`. `seq` increases for every message and survives reboot (persisted every N); `ts` is UTC milliseconds from SNTP and `tq` says whether the clock was synced. The backend never trusts `gw` from the payload: it takes the gateway id from the **authenticated broker identity**.

**Data batch (raw):**
```json
{ "v":1, "seq":88121, "ts":1791800000123, "tq":1, "slave":1, "plan":42,
  "blocks":[ {"r":169,"w":[1250,0,2410,...],"ok":1}, {"r":603,"ok":0,"err":"timeout"} ] }
```
Raw words, one entry per block, **`ok:0` with the reason where the inverter did not answer**. `plan` is the poll-plan version the batch was read under, so the backend decodes with the matching rules.

**Command (signed):**
```json
{ "v":1, "id":"7c0e…", "exp":1791800060000, "slave":1, "op":"write",
  "reg":243, "mask":"0xFFFF", "val":1, "sig":"HMAC-SHA256 over id|exp|slave|reg|mask|val" }
```
The gateway checks the signature with its per-device key, the expiry (60 s), the register against the signed allow-list, and its own deny-list, performs the (read-modify-write) write, **reads the register back**, and publishes the ack.

**ACLs (deny by default):** a claimed gateway may publish only under `wt/v1/gw/{its id}/up…` and subscribe only to `wt/v1/gw/{its id}/down…`; an unclaimed gateway only to its `boot` topics; the backend's own user may do both on `wt/v1/gw/+/…`. No wildcard for devices. Mosquitto's Dynamic Security plugin gives per-client roles that can be changed while the broker runs **[verified]**; `use_identity_as_username` ties a client certificate's name to the account if we later move to client certificates.

---

## 7. Backend: `D:\Manoj-Waytara\waytara server\`

Node 20+, TypeScript, Express. Layout:

```
waytara server/
  src/
    config/        env validation (zod), one place for every setting
    http/          Express app, routes, middleware (helmet, cors allow-list, rate limit, request id, error handler)
    auth/          Supabase JWT verification (jose + JWKS), role guard, gateway auth
    mqtt/          broker client, topic router, command publisher
    pipeline/      validate -> decode -> quality -> store -> push
    decode/        register rules (scale, offset, signed, bitmask, combine, bitset, ascii, hhmm, date) + golden-vector tests
    store/         local data files, rotation, compression, 30-day sweep
    supabase/      the only code that talks to Postgres (functions only)
    live/          Go Live WebSocket hub
    commands/      write pipeline and its state machine
    jobs/          retention, heartbeats, offline detection, alert triggers
    ocpp/          EV charger WebSocket adapter (later phase)
  data/  logs/     cache on the Render free disk (lost on restart); hourly upload to Supabase Storage, 30 days
  tests/
```

### 7.1 Middleware, in order
`helmet` → CORS allow-list (only your app origins) → request id + `pino-http` (no secrets, no bodies of credentials) → body size limit → rate limit (per IP and per user) → JWT verification → role guard → zod validation of every body → handler → audit log → error handler that never leaks internals. `/healthz` (process up) and `/readyz` (broker and database reachable). On SIGTERM: stop accepting, close WebSockets with a clear code, flush files (Render's default shutdown delay is 30 s) **[verified: Render WebSocket guide]**.

### 7.2 Authentication
* **People:** the app sends its Supabase access token; the backend verifies the signature locally against the project's **JWKS** (`/auth/v1/.well-known/jwks.json`, public keys, cached; this works only when the project uses asymmetric signing keys, otherwise the Auth server's `/user` endpoint is used) **[verified: Supabase JWT docs]**. Check issuer, audience and expiry. Then the role and ownership come from the database (`gw_whoami`), **never from the token alone**.
* **Gateways:** the broker authenticates them (per-device username and secret, later client certificates); the backend only ever trusts the identity the broker reports.
* **WebSocket:** the token travels in the first message (or a subprotocol), never in the URL, because URLs end up in logs.

### 7.3 The data pipeline (the heart)

```
MQTT data batch
  1 identify   gateway id (from broker identity) → equipment + slave + plan (cache, refreshed on cfg change)
  2 dedupe     (gateway, seq) seen? drop. gap? mark the gap, accept late fill.
  3 time       use ts if tq=1 and |ts − now| < 2 min, else mark the batch "time unsure" and stamp receive time
  4 decode     raw words → values with the catalogue rules; bit sets → fault lists; 32-bit counters; ascii; hhmm
  5 validate   range from valid_min/valid_max, plausibility, counter never goes backwards, units
  6 quality    each value gets: good | stale | no_data | out_of_range | decode_error | time_unsure
  7 store      append to the local file for that equipment and day (every value, quality included)
  8 live       hand to the Go Live hub (in memory)
  9 push       on the Supabase cadence: latest values + open bucket + heartbeat via the gateway-role function
```

**Cadences, in plain words.** *Read cadence* = how often the gateway reads each metric (from `equipment_metrics.cadence_seconds`, editable by admin). *Local file cadence* = every value as read. *Supabase push cadence* = how often the backend sends the **latest** values and the 15-minute buckets to Supabase (default 15 minutes as today; the admin can set it from 1 minute up). **"Every second to Supabase" is deliberately not offered:** the one-second view is Go Live over the WebSocket, which costs no database rows. At 1 s, one device would write about 86 400 × (number of keys) rows a day.

### 7.4 Local files, the durable 30-day copy, and retention

* **Local files:** `./data/{equipmentId}/{yyyy-mm-dd}.ndjson`, one line per value: `{t, k, v, q}` (time, key, value, quality). They serve Go Live backfill and recovery. For EV chargers the same folder keeps the **raw OCPP frames** in both directions (`{t, dir, cp, frame}`), like the `ocpp_server_log.jsonl` the current local server writes.
* **On Render free the disk is not durable.** The filesystem is lost on every redeploy, restart and spin-down, there are no persistent disks, and Render may restart a free service at any time **[verified: Render free-tier page]**. So the files are a **cache**. The durable copy is made **hourly**: each finished hour is gzipped and uploaded to a private **Supabase Storage** bucket `gateway-archive` as `{equipmentId}/{yyyy-mm-dd}/{hh}.ndjson.gz` (logs go to `logs/{yyyy-mm-dd}/{hh}.log.gz`). A restart therefore loses at most the current hour of the cache, and the gateway's own buffer plus the Supabase roll-ups cover that gap.
* **Upload without a service key:** the backend signs in as its **service user** and a **Storage RLS policy** lets only that user write and read this one bucket. The admin app reads an archive through a short-lived signed URL created by an admin-only function. Customers have no policy on the bucket.
* **Retention, one rule:** a nightly job deletes archive objects older than **30 days** (and the local files older than that). Nothing older than 30 days is kept in the archive, the logs, the gateway buffer or the gateway's own log.
* **Size, from the real catalogue [inferred]:** about 2 million values a day at the current cadences, roughly 25 MB plain and 3 MB gzipped per inverter per day, so about **90 MB per inverter for 30 days**. Check the Storage allowance of your Supabase plan (the free plan's figure is not something I verified); about ten inverters per gigabyte.
* **Later:** with a paid Render instance and a persistent disk (or your own server) the local files become the durable copy and the upload becomes an optional second copy.
* **What is NOT 30 days:** the 15-minute roll-ups stay **8 days** and the hourly and daily roll-ups stay as they are (decided); EV **transaction records** are kept long term (section 7.8) because they are usage and billing records, not raw data. Say if you want those cut as well.

### 7.5 Logs
Structured JSON (`pino`): request id, user id, gateway or charger id, event, outcome; never tokens, secrets or full credentials. Written to the console (Render's own log view is short-lived) and to rotating files, then uploaded hourly like the data (section 7.4) and purged after 30 days. The admin app reads them **on demand** through `GET /v1/admin/logs?date=&hour=` (admin role, rate-limited, decompressed as a stream), and a short "recent events" list comes from `gateway_events` in the database.

### 7.6 Go Live
1. The browser opens `wss://…/v1/live` and sends `{"auth": "<Supabase token>", "equipment":"…", "keys":["battery_soc_pct", …]}`.
2. Backend verifies the token and calls `gw_can_view(user, equipment)`; limits: ≤ 3 viewers per device, ≤ 40 keys, session ≤ 30 minutes (renewable).
3. It sends a **backfill** (the last 60 minutes from an in-memory ring, older points of the day from the 15-minute roll-ups and the archive) and then streams live values. If the normal cadence is slower than 1 s, it publishes `live/start {keys, rate:1}`; the gateway reads just those keys fast (about 15 values fit in a second).
4. The client sends a ping every 10 s and a `pause` when the tab is hidden (`visibilitychange`). **No ping for 30 s, a `stop`, a closed socket, or the 30-minute limit ends the session**; the backend then publishes `live/stop` unless another viewer remains, and the gateway returns to its plan.
5. Every live frame carries the same quality flag as stored data.

### 7.7 Command (write) pipeline

```
app ──POST /v1/equipment/:id/commands {key, value}──► backend
  1 verify JWT, load role
  2 gw_authorize_command(user, equipment, key, value)   -- Postgres function:
        metric exists, direction = write, has a register, show_for_user / role / plan allow it,
        value inside valid_min/valid_max and of the right kind, not a duplicate of the current value
  3 insert equipment_commands (status queued) + audit_log
  4 publish signed command (QoS 1, expires in 60 s)
  5 gateway writes (read-modify-write for bit fields), READS BACK, acks
  6 backend: ack ok  → status acked_ok, append equipment_configs (source agent_write_ok, value = the read-back)
            mismatch/timeout → failed, append agent_write_failed (what the inverter holds + why)
  7 Supabase Realtime pushes equipment_commands / equipment_configs to the app (RLS: owner only)
```
The page already shows "waiting / confirmed / not taken" from `equipment_configs`; it will follow `equipment_commands` the same way. Rate limit per device and per register; a write that equals the confirmed value is skipped (the inverter keeps settings in flash).

### 7.8 EV chargers over OCPP: the backend is the central system (CSMS)

**What exists today [verified from `D:\Manoj-Waytara\EV Web Socket\` and the database]**

* A real charger: **Plugzmart 7.4 kW AC**, model `MERDM12R01XXXX`, firmware 2.2.7, charge point id **`WT_PZ_7k_1`**, speaking **OCPP 1.6-J** over WebSocket. The database already holds two charger equipment (7.4 kW AC and 50 kW DC), each with 150 to 185 OCPP-shaped metrics (meter values, connector status, OCPP configuration keys, remote commands, billing), and an `ev_sessions` table that a cron job (`detect-charging-sessions`, every 2 minutes) fills by **guessing** sessions from energy readings.
* A local **Python CSMS** (`local_server.py`, OCPP on port 9220, its own dashboard on 8000). The log of 5 Oct shows the traffic: `BootNotification` (the server answers `Accepted`, heartbeat `interval: 10`), `StatusNotification` (Available, Preparing, Charging, Finishing with `OtherError`), `Heartbeat` every 10 s, `StartTransaction`, `MeterValues`, `StopTransaction`, and from the server `RemoteStartTransaction`, `RemoteStopTransaction`, `UnlockConnector`.
* **What the current local server gets wrong for production:** the charger is identified only by the URL (no authentication), a control password is written in the source, logs are plain files, and sessions are a JSON file. The backend replaces all of that.
* **A unit trap in the real data:** the charger sends energy as `"52.87"` with `"unit":"kWh"` and power as `"0.00"` with `"unit":"kW"`, while OCPP's default is Wh and W when the unit is missing. Decoding must **read the unit from every sampled value**; assuming Wh would be wrong by 1000 times.

**The endpoint and authentication**

* `wss://<host>/ocpp/{chargePointId}`, subprotocol `ocpp1.6` (and `ocpp2.0.1` later). OCPP-J framing: `[2,id,action,payload]` call, `[3,id,payload]` result, `[4,id,code,description,details]` error. The backend checks every payload against the OCPP JSON schemas before acting (for example with an OCPP RPC library for Node that validates 1.6 and 2.0.1 [spike: pick one]).
* **This is the equipment's WebSocket channel of section 5.3.** The charge point id must belong to an `equipment` row of category `ev_charger`; an unknown id is refused **before** the WebSocket upgrade. The password is that equipment's **equipment key**, sent as HTTP Basic authentication (user = charge point id), which is OCPP security profile 2 (TLS plus Basic).
* **Risk to prove first [spike with the real charger]:** the charger's firmware must support **`wss://` with a normal public certificate** and **Basic authentication** (the catalogue has a `security_profile` setting for this). Render serves only HTTPS, and plain `ws://` clients are answered with a redirect that most WebSocket clients do not follow **[verified: Render WebSocket guide]**. If the Plugzmart firmware cannot do TLS or Basic auth, the choices are: a TLS-terminating proxy in front (for example Cloudflare Tunnel, or your own server with Caddy), or a short-lived URL token on the charger's path as a last resort (URLs reach logs, so it would need redaction, a short expiry and an IP allow-list).

**Messages the backend handles**

| From the charger | The backend does |
|---|---|
| `BootNotification` | records vendor, model, serials, firmware (`charge_point_*`, `firmware_version`); answers `Accepted` with a heartbeat interval of 30 s (the catalogue's `heartbeat_interval_s` is editable); an unknown or disabled charger gets `Rejected` |
| `Heartbeat` | replies with the current time; updates `charger_online_status` and `equipment_heartbeat` |
| `StatusNotification` | connector status, error code and info into `connector_status`, `error_code`, `error_info`; an error raises a fault record |
| `Authorize` | checks the tag against the local list and policy; stores only a **hash** of an RFID tag for the customer view |
| `StartTransaction` | creates the transaction (server-side id), stores the meter start, opens the session |
| `MeterValues` | decodes each sampled value with its own unit into the energy-meter keys (table below), runs the pipeline of section 7.3 |
| `StopTransaction` | closes the transaction with the meter stop and the stop reason |
| `DataTransfer`, `DiagnosticsStatusNotification`, `FirmwareStatusNotification` | stored as events; vendor data is never trusted as a reading |

| To the charger (the catalogue's `command` rows) | When |
|---|---|
| `RemoteStartTransaction`, `RemoteStopTransaction`, `UnlockConnector`, `Reset`, `ChangeAvailability`, `TriggerMessage` | the command pipeline of section 7.7, with the same authorisation and audit |
| `GetConfiguration`, `ChangeConfiguration` | the catalogue's OCPP configuration keys (heartbeat, meter-value interval, security profile, ...): read at connect, written through the same read-back rule |
| `SetChargingProfile`, `ClearChargingProfile` | current or power limits (`charging_limit_value`) |
| `UpdateFirmware`, `GetDiagnostics` | admin only |
| `ReserveNow`, `CancelReservation`, `SendLocalList`, `ClearCache` | later |

**Mapping to the catalogue (examples; the unit always comes from the message)**

| OCPP measurand (phase) | Key |
|---|---|
| `Energy.Active.Import.Register` | `energy_active_import_register_kwh` |
| `Power.Active.Import` (L1/L2/L3 or total) | `power_active_import_kw` (and `_l1_` ...) |
| `Voltage` (L1-N, L2-N, L3-N, L1-L2 ...) | `voltage_l1_n_v` ... |
| `Current.Import` (L1, L2, L3) | `current_import_l1_a` ... |
| `Frequency`, `Power.Factor`, `Temperature`, `SoC`, `Current.Offered` | `frequency_hz`, `power_factor`, `charger_body_temperature_c`, vehicle SoC, `current_offered_a` |
| `StartTransaction` / `StopTransaction` | `transaction_id`, `meter_start_wh`, `meter_stop_wh`, `session_start_time`, `session_stop_time`, `stop_reason` |

**What is stored, and where**

1. **Raw frames:** every frame in both directions, one NDJSON file per charger per day (as the current server does), gzipped hourly to the archive, **30 days** (section 7.4).
2. **Readings:** the decoded values go through the same pipeline as the inverter: quality flags, `equipment_latest`, the 15-minute roll-ups (8 days), hourly and daily roll-ups, `equipment_heartbeat`.
3. **Transactions (the authoritative record):** a new `ev_transactions` table written only from OCPP transaction messages, **not guessed from energy readings** the way `detect-charging-sessions` does today. The existing `ev_sessions` rows become a view over it. Energy for billing is **meter stop minus meter start**, never a sum of samples.

```sql
create type waytara.ev_tx_status as enum ('active','completed','suspect','closed_by_server');
create type waytara.ocpp_registration as enum ('accepted','pending','rejected');

ocpp_charge_points (equipment_id uuid pk, charge_point_id text unique, vendor, model, serial, firmware, ocpp_version,
                    registration ocpp_registration, last_boot_at, connectors int, config jsonb, last_seen)
ev_transactions    (id uuid pk, equipment_id, connector_id int, ocpp_transaction_id int, id_tag_hash text,
                    meter_start_wh numeric, meter_stop_wh numeric, started_at timestamptz, stopped_at timestamptz,
                    stop_reason text, energy_kwh numeric, status ev_tx_status, note text,
                    unique (equipment_id, ocpp_transaction_id))
ev_events          (id, equipment_id, ts, kind, detail jsonb)           -- boot, status, error, firmware, diagnostics; 30 days
```

**Integrity rules (no false data):**
* a repeated message id is answered again but stored once; messages are processed in order per charger;
* a transaction started while the charger was offline arrives later with its own timestamp and is stored with that time;
* `meter_stop >= meter_start` and `energy_kwh <= rated power × duration × 1.1`, otherwise the transaction is marked **`suspect`**, not silently corrected;
* a transaction with no meter values for 2.5 × the interval while the connector reads Available is closed by the server and marked **`closed_by_server`**;
* `RemoteStartTransaction` answered `Accepted` only means "will try": the session exists when the charger sends `StartTransaction`;
* "stop at N kWh" (the current local server has it) is done by the backend watching `MeterValues` and sending `RemoteStopTransaction`; it can overshoot a little and does not work while the charger is offline, so the screen says so.

**Connection health:** WebSocket ping every 30 s plus the OCPP heartbeat; no frame for 2.5 × the interval, or a closed socket, means offline (`charger_online_status`). A second connection with the same id replaces the first after a failed ping. On Render free every redeploy drops all sockets and chargers must reconnect (many chargers back off for a while: measure it with the real one).

**Testing:** the existing `test_simulator.py` becomes a conformance harness (boot, status, heartbeat, a full transaction with meter values, offline start, duplicate messages, an energy rollback), plus a 24-hour run with the real charger comparing the charger's own display with the stored transaction energy.

### 7.9 Deployment on the Render free plan, and the way out
* **One free web service** (`waytara-server`): Express, the embedded Aedes broker over WSS, the Go Live WebSocket, and the OCPP endpoint, all on the one HTTPS port. A second free service is not possible in practice: a workspace gets **750 free instance hours a month** and one always-on service already uses about 744, and a free service cannot receive private-network traffic **[verified: Render free-tier page]**.
* **Staying awake:** a free service spins down after **15 minutes without inbound traffic**, and HTTP requests and **WebSocket messages on existing connections count as traffic**, so a connected gateway (MQTT keep-alive every 30 s) or charger (OCPP heartbeat) keeps it up. If every device is offline it sleeps, and the next connection wakes it in about a minute **[verified]**. Devices retry, so this is acceptable. **[spike: 72 hours with the real gateway and charger]**
* **Restarts:** Render may restart a free service at any time **[verified]**. The design assumes it: gateways buffer and reconnect, the backend rebuilds its state from Supabase on boot, and **status is computed from heartbeat times stored in Supabase**, not from the broker's memory (an embedded broker forgets retained messages and last-wills on restart).
* **Memory and bandwidth discipline:** Render does not state CPU or RAM for free services and bills outbound bandwidth beyond an included amount (suspending free services without a payment method) **[verified]**. So ring buffers have fixed caps, and Go Live is limited to 30-minute sessions and a few viewers (one viewer of 15 values a second is about 2 KB/s, 170 MB a day if left on all day).
* **Secrets** only in Render environment variables. Nothing in git, firmware or the browser.
* **The way out, in order:** (1) Render Starter plus a persistent disk (files become durable); (2) a separate Mosquitto service; (3) your own server with plain MQTTS 8883, Caddy for TLS, the same Docker images. The firmware changes only a URL in its signed config; the OCPP charger changes its central-system URL.

---

## 8. Supabase: access without a service key, and the database

### 8.1 How the backend reaches the database
Supabase's new **secret keys** replace `service_role` and still **bypass RLS** with full access, so they do not give least privilege **[verified: Supabase API-key docs and the community thread]**. Options, best first:

| # | Option | Least privilege | Effort | Risk |
|---|---|---|---|---|
| **1** | A **dedicated Postgres role** `waytara_gateway` (`LOGIN`, no `BYPASSRLS`), granted `EXECUTE` on about ten `SECURITY DEFINER` functions and nothing else, connected through the **Supavisor session pooler** (IPv4, port 5432, supports LISTEN/NOTIFY) | **Best** | medium | **[spike]** the exact login string for a custom role through the pooler is not in the docs I could read; the dashboard's Connect dialog shows it. Session mode is also needed if we use `LISTEN`. |
| 2 | A **service user** in Supabase Auth (email + password, long random), RLS and function checks restricted to that user id | good | low | works with PostgREST and Realtime; the `authenticated` role is shared with customers, so every function must check the caller is the gateway user |
| 3 | A minted JWT for a custom role signed with an imported signing key | good | high | unofficial; revoking the key kills every token |
| ✗ | `service_role` / secret key in Render | none | none | rejected, as you said |

**Recommendation, now that Render free is the host:** start with **option 2** (the service user), because it is the one identity that reaches **everything the backend needs**: the `gw_*` functions through the API, **Supabase Storage** for the hourly archive (section 7.4), and Realtime. A Postgres role (option 1) cannot call the Storage API. Every `gw_*` function is revoked from `public`, `anon` and `authenticated` except through a check at the top (`auth.uid()` must be in `gateway_service_users`), and the Storage policy names the same user, so a customer login that calls the same function is refused. The backend signs in with email and password at boot and refreshes the token (the Supabase client does this). **Later,** on a paid instance or your own server, DB access moves to option 1 (the pooler role) and only the archive upload keeps the service user. The direct database host is IPv6-only by default, so use the pooler from Render unless Render is proven to reach IPv6 **[verified: Supabase docs]**. **[spike: sign-in and token refresh from Render free, one `gw_*` call, one Storage upload under the policy, and a customer token refused]**

What the role can do (all `SECURITY DEFINER`, `search_path` pinned, inputs validated inside):
`gw_whoami(user_id)`, `gw_can_view(user_id, equipment_id)`, `gw_get_plan(gateway_id)`, `gw_ingest(gateway_id, ts, values, quality, open_bucket, closed_buckets)` (wraps today's `ingest_tick`), `gw_heartbeat(...)`, `gw_event(...)`, `gw_authorize_command(...)`, `gw_command_result(...)`, `gw_claim_request(hw_id, ...)`, `gw_claim_approve(admin_id, ...)`. No table grants. It cannot read customer profiles, tariffs or reports.

**Blast radius, honestly:** the backend is still the trust boundary. A stolen database role can fake readings for any gateway, but cannot read customer personal data, cannot touch billing, cannot create users. That is the difference from a service key.

### 8.2 Tables to add (sketch)
```sql
create type waytara.gateway_status  as enum ('unclaimed','claimed','active','disabled','retired');
create type waytara.command_status  as enum ('queued','sent','acked_ok','failed','expired','cancelled');
create type waytara.data_quality    as enum ('good','stale','no_data','out_of_range','decode_error','time_unsure');
create type waytara.fault_severity  as enum ('info','warning','critical');
create type waytara.fault_kind      as enum ('fault','warning','alarm');
create type waytara.link_kind       as enum ('wifi','cellular','ethernet');

gateways            (id uuid pk, hw_id text unique, board_model, firmware, status gateway_status, claimed_by uuid, claimed_at, last_seen, last_reset_reason, link link_kind)
gateway_credentials (gateway_id pk -> gateways, broker_user, secret_hash, cmd_key_hash, created_at, revoked_at)
gateway_equipment   (gateway_id, equipment_id, slave_id, baud, parity, stop_bits, profile_id, read_plan_version, push_interval_s, primary key (gateway_id, equipment_id))
equipment_commands  (id uuid pk, equipment_id, key_name, requested_value, requested_by uuid, status command_status, result_value, error, created_at, sent_at, acked_at)
gateway_events      (id, gateway_id, ts, kind, detail jsonb)         -- 30-day retention
fault_codes         (code text pk, brand, kind fault_kind, word int, bit int, severity fault_severity, label, description, solution)
equipment_faults    (id, equipment_id, code -> fault_codes, raised_at, cleared_at)
```

Also from earlier sections: `equipment_keys` and `equipment_key_events` (5.3), `ocpp_charge_points`, `ev_transactions` and `ev_events` (7.8), and `gateway_service_users` (8.1).

### 8.3 "Use the enum for fault codes"
* **Native Postgres `ENUM` types** are right for **small, closed** sets that we control: statuses, severity, quality, link kind (above).
* **Vendor fault codes should be a lookup table** (`fault_codes`), not a native enum, because a Postgres enum cannot drop a value, adding one needs a migration, and each brand and model has a different list. You already have this shape: `equipment_enum` holds `fault_code` (29 rows, F07 …) and `warning_code` (4 rows). The plan keeps `equipment_enum` for **display and compatibility** and adds `fault_codes` with the **word and bit position**, so the backend can turn a raw fault word into a list of codes and write each to `equipment_faults` (raised/cleared times). A foreign key on `fault_codes.code` gives the same "only valid codes" guarantee an enum would.
* The web app's `deye-fault-codes.ts` text moves into `fault_codes.label/description/solution`, so the customer wording is edited in one place.

### 8.4 Realtime and retention
* **Database → apps** stays Supabase Realtime (already built): `equipment_configs`, `equipment_commands`, `equipment_heartbeat`, `ev_transactions` with RLS.
* **Retention (settled):** local files, the archive, logs, gateway events, key events and EV events: **30 days**. In Supabase `equipment_rollup_15m` keeps **8 days** (as now), `rollup_1h` and `rollup_1d` keep forever (needed for yearly reports and savings). EV **transactions** are kept long term as usage and billing records (a few rows per charge) unless you say otherwise.

---

## 9. Decoding: where it happens and the rules

* **Today:** the Python agent decodes using `equipment_metrics`. **Target:** the backend `decode/` module, same rules, written in TypeScript with **golden-vector tests** (raw word in, value out) taken from the 10 Sep register sweep and from the inverter LCD photos, so a rule change cannot silently change a number.
* The complete formula table for the Deye 8K, with a cross-check against the sweep, is in [DEYE_8K_REGISTER_DECODE.md](DEYE_8K_REGISTER_DECODE.md). **Nine findings there matter before go-live**, the main ones:
  1. **Fault/warning/alarm words are bit sets**, but today the whole word is stored and read as one code. A real `F13` would display as an unknown code. Needs the `bitset` decode.
  2. **Beep and auto-dim registers are command-only**: reading them gives "no action", so the app shows "off" whatever the inverter does.
  3. **The generator energy counter (R92 with R95) is unproven** and the sweep labels those registers differently.
  4. **R603 and R611 never answered** in the sweep: must be "no data", not 0.
  5. **41 of 375 read metrics and 24 of 63 write metrics are not marked verified**; 29 of them are visible to customers today. Hide until proven.
* **Derived metrics** (energy shares, CO₂, savings, backup time, round-trip efficiency) are computed in the backend from stored values and left empty if any input is missing.

---

## 10. "No false data": the rules

1. **No answer is not zero.** A Modbus timeout, exception or CRC error becomes `no_data`. The UI shows "—" and "last read 3 min ago", never a number.
2. **Stale is labelled.** A value older than 2.5 × its cadence is `stale`; the dashboard grays it.
3. **Identity before data.** The first thing a claimed gateway reads is the inverter's serial number and type; a mismatch with the equipment record stops all data from that gateway.
4. **Right map for the right inverter.** The poll plan carries the profile and version; the batch carries the plan version it was read under.
5. **Range and plausibility.** `valid_min/valid_max`; energy counters may not go backwards; temperatures and voltages inside physical limits; a power balance check (PV + grid + battery ≈ load within a tolerance) raises a data-quality event, not a value change.
6. **Time.** The gateway's `tq` flag; a batch with an unsynced or 2-minutes-off clock is stamped with receive time and marked `time_unsure`.
7. **Writes show truth.** The app shows the **read-back** value; a request that the inverter did not take is shown as not taken.
8. **Unverified metrics are not shown to customers** until someone has confirmed them (a `verified` flag already exists).
9. **Derived values need all inputs.** Missing input means no output.
10. **Every value in the files and in Supabase carries its quality**, so a report can exclude bad data instead of averaging it in.

---

## 11. Security model

| Threat | Control |
|---|---|
| Stolen gateway | per-device broker credential, admin revokes it in one click; secrets in encrypted NVS; production units with flash encryption and secure boot |
| Someone joins the setup Wi-Fi | WPA2 key and setup PIN per device; the page cannot pick a customer or see data; AP closes after claim |
| Forged commands | signed, expiring, id-unique; checked against a signed allow-list and a firmware deny-list; broker ACL stops devices from writing to `down` topics |
| Device pretending to be another | gateway id comes from the broker identity, not the payload; ACL per device |
| Customer reads another customer | JWT verified, ownership via `gw_can_view`; RLS on every table; WebSocket authorised per equipment |
| Leaked backend secret | database role can only call ~10 functions; broker credentials rotatable; no service key anywhere |
| Replay | `seq` + `exp`; the backend drops repeats |
| Eavesdropping | TLS everywhere (WSS/MQTTS/HTTPS); the one thing that is not encrypted is the setup page on its own access point, which carries only Wi-Fi credentials over WPA2 |
| Bad firmware | signed OTA, rollback if the new image does not prove itself |
| Brute force / flood | rate limits per IP and user, WebSocket caps, broker connection limits |
| Leaked equipment key | bound to one equipment and one channel, scopes, optional IP allow-list, rate limit; admin revokes in one click and sessions close within seconds; use from a new IP alerts the admin |
| Someone connects as a charger | the charge point id must exist and the Basic-auth password must be that equipment's key; unknown ids are refused before the WebSocket upgrade; OCPP schema validation; frame-size and rate limits |
| Fake or duplicated EV transaction | transactions come only from OCPP messages, are unique per charger and transaction id, energy is meter stop minus meter start, and implausible energy is marked suspect, not corrected |
| Render restarts or sleeps the service | gateways and chargers buffer and reconnect; status comes from stored heartbeat times, not broker memory; hourly archive limits loss |

---

## 12. Capacity (from the real catalogue)

| Item | Number |
|---|---|
| Registers read from the Deye | 388 distinct; 375 metrics |
| One full pass over everything | ≈ 32 blocks, ≈ 3.5 s **[estimate, measure]** |
| "Every 5 s" tier | 37 registers, 4 blocks, ≈ 0.4 s |
| 1-second Live | ≈ 15 key values |
| Values per day at today's cadences | ≈ 2 million |
| Archive per inverter | ≈ 25 MB/day plain, ≈ 3 MB/day gzipped, ≈ 90 MB for 30 days (Supabase Storage on the free plan) |
| EV charger | one 7.4 kW AC charger sent 311 heartbeats and 14 meter-value messages in 100 minutes in the 5 Oct log; frames are small, so the raw log is a few MB a day |
| Supabase rows (15-min buckets) | ≈ 9 000 a day per device (unchanged) |
| Broker | embedded Aedes inside the one free Render service for now: one gateway sends a few kbit/s; Render free gives 750 instance hours a month, so exactly one always-on service. Managed brokers were checked and set aside (HiveMQ free: 100 connections and 10 GB a month; EMQX Serverless: 1 000 connections and 1 GB a month, listed without JWT/HTTP authentication) **[verified: vendor pages, partly third-party]** |

---

## 13. Roadmap and acceptance tests

| Phase | Build | Done when |
|---|---|---|
| **0** (days) | Arduino sketch reads R3 to R7 and R16 to R17 from the Deye over RS485, prints them | serial number and rated power match the LCD and the xlsx |
| **1** Backend skeleton | `waytara server`: config, auth, embedded broker, decode module with golden vectors, pipeline to files and the hourly archive, `gw_*` functions, service user, equipment keys (create, rotate, revoke) | golden-vector tests pass; the service user can run `gw_ingest` and a customer token cannot; a revoked key is refused within 15 s; **spikes pass** (Aedes over WSS on Render free for 72 h, sign-in and Storage upload under RLS) |
| **1b** OCPP central system | `/ocpp/{chargePointId}` for the **Plugzmart 7.4 kW AC charger that already exists**: schema validation, key-based login, boot, heartbeat, status, authorize, transactions, meter values with units, raw-frame files, `ocpp_charge_points`, `ev_transactions` | the real charger completes a charge; stored transaction energy equals the charger's display within the meter's resolution; duplicate and offline-start cases from the simulator pass; **first confirm the charger can use `wss://` with Basic auth** |
| **2** Gateway firmware | ESP-IDF project: boot checks, Wi-Fi manager, scan page, net check, MQTT with last-will, Modbus engine, heartbeat, buffer | 72-hour soak: unplug RS485, power-cut, Wi-Fi drop: statuses correct, no gaps filled with zeros, buffered data arrives in order once |
| **3** Claim + admin app | claim flow, Gateways module in `apps/admin`, link probe, remote reboot/rescan | a new gateway is claimed by an admin only; claiming a wrong inverter is refused |
| **4** Customer features | Go Live over WSS, command pipeline with read-back, `equipment_commands`, fault bit-set decode | write → LCD shows the same value → app shows the read-back; Go Live ends within 30 s of tab close |
| **5** Operations | OTA with rollback, log viewer, retention jobs, alerts from `equipment_faults`, EV remote start/stop/limits through the command pipeline, 4G option, admin Keys tab and usage view | 30-day retention proven by a date-shifted test; rollback proven with a deliberately broken image; revoking a key from the admin app drops its live session |
| **6** Harden | secure boot, flash and NVS encryption on production units; move broker to your server | an extracted flash image yields no credentials |

**Each phase is also tested against the physical unit:** compare 20 values on the inverter LCD (photos) with the dashboard at the same minute.

---

## 14. Decisions and unknowns

**Settled on 2026-10-13:** board = Waveshare ESP32-S3-RS485-CAN; hosting = Render free plan for now; 15-minute roll-ups = 8 days; the backend also acts as the OCPP central system and stores the charger data; admins create and manage a unique key and WebSocket channel per equipment.

**Still open**
1. **The 29 unverified customer-visible metrics** (listed in the decode file, section 9; all are bit-field registers on the settings page that disagreed with the inverter screen earlier): hide them now, or verify them one by one on the unit with the LCD?
2. **Installers** (the `site_engineer` role): do they each see only their assigned sites?
3. **Customer sub-users** (family or staff under one account): first release or later?
4. **EV transactions:** keep them long term (my default, they are billing records), or also 30 days?
5. **RFID tags** are personal data. Default: store only a hash and show a short label to the customer. OK?
6. **The Plugzmart charger's TLS and Basic-auth support** decides whether it can connect straight to Render. I need to look at its OCPP settings (or ask the vendor) before phase 1b.

**Spikes (each one afternoon)**
* Aedes (embedded MQTT over WSS) inside a free Render service: a gateway **and** a charger connected for 72 hours, spin-down and restart behaviour, reconnect times.
* Service-user sign-in and token refresh from Render, one `gw_*` call, one Storage upload under the policy, a customer token refused.
* The Plugzmart charger over `wss://` with Basic authentication (and what happens on a Render redeploy).
* Real Modbus timing on your unit: block sizes the Deye accepts, response time, error behaviour (no vendor figure exists in the sources I found; some devices cap a read well below 125 registers).
* The fault-word bit order against the manual's fault table.
* Web Bluetooth provisioning on your installers' phones (Android Chrome yes; iPhone no).

**What I could not verify:** Render free's CPU and RAM (the page does not state them) and its included bandwidth, Supabase's Storage allowance on your plan, the exact price lines of the brokers (sources disagree on some), EMQX Serverless' built-in-database ACL features, which OCPP library to use, Deye's official Modbus document (I used your catalogue and sweep instead), and any vendor guidance on EEPROM wear for repeated writes (so writes are skipped when unchanged and rate-limited).

---

## 15. Sources

* Waveshare, [ESP32-S3-RS485-CAN](https://www.waveshare.com/esp32-s3-rs485-can.htm) and [ESP32-S3-SIM7670G-4G](https://www.waveshare.com/product/esp32-s3-sim7670g-4g.htm); CNX Software, [Waveshare ESP32-S3 4G boards](https://www.cnx-software.com/2024/02/20/waveshare-esp32-s3-4g-dev-boards-feature-lte-cat-1-2g-and-camera-support/)
* Render, [Deploy for Free](https://render.com/docs/free), [Persistent Disks](https://render.com/docs/disks), [WebSockets on Render](https://render.com/docs/websocket); Render community, [MQTT on Render](https://community.render.com/t/render-cloud-services-can-support-for-mqtt/18126) and [listening to MQTT on a TCP port](https://community.render.com/t/listen-to-mqtt-from-localhost-tcp-port/24782)
* HiveMQ, [Cloud Serverless vs Starter](https://www.hivemq.com/blog/hivemq-cloud-serverless-vs-starter-mqtt-iot-or-iiot/); EMQX, [pricing](https://emqx.io/en/pricing), [Cloud authentication overview](https://docs.emqx.com/en/cloud/latest/deployments/auth_overview.md); Mosquitto, [Dynamic Security](https://mosquitto.org/documentation/dynamic-security/)
* MQTT status and last-will pattern: HiveMQ, [Managing IoT device state within MQTT](https://hivemq.com/blog/managing-iot-device-state-within-mqtt); IBM, [mqtt-status-pattern](https://github.com/ibm-messaging/mqtt-status-pattern/wiki); [MQTT security best practices](https://iiot-world.com/ics-security/cybersecurity/securing-mqtt-best-practices-iiot)
* Supabase, [API keys](https://supabase.com/docs/guides/getting-started/api-keys), [migrating to publishable and secret keys](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys), [JWTs and JWKS](https://supabase.com/docs/guides/auth/jwts), [IPv4 and IPv6 compatibility](https://supabase.com/docs/guides/troubleshooting/supabase--your-network-ipv4-and-ipv6-compatibility-cHe3BP), [accessing Postgres (session vs transaction mode)](https://supabase.com/docs/guides/self-hosting/accessing-postgres)
* Espressif, [ESP-IDF security overview (ESP32-S3)](https://docs.espressif.com/projects/esp-idf/en/v5.2/esp32s3/security/security.html), [Unified Provisioning](https://docs.espressif.com/projects/esp-idf/en/v5.1/esp32/api-reference/provisioning/provisioning.html), [ESP-MQTT](https://esp-idf.readthedocs.io/en/latest/api-reference/protocols/mqtt.html), [OTA and rollback](https://docs.espressif.com/projects/esp-idf/en/latest/esp32h4/api-reference/system/ota.html), [esp-modbus](https://components.espressif.com/components/espressif/esp-modbus/versions/2.1.4/examples/get_started/basic_master), [Modbus (ESP32-S3)](https://docs.espressif.com/projects/esp-idf/en/v5.5/esp32s3/api-reference/protocols/modbus.html); Random Nerd Tutorials, [ESP-IDF Wi-Fi scanner](https://randomnerdtutorials.com/esp-idf-esp32-wi-fi-scanner/); [Web Bluetooth browser support](https://www.beaconzone.co.uk/blog/browser-support-for-web-bluetooth/)
* Deye on RS485: Home Assistant community, [Deye SUN-3.6K Modbus thread](https://community.home-assistant.io/t/deye-sun-3-6k-sg05lp1-eu-am2-p-help-home-assistant/1017770); your own `Deye_Inverter_Full_Guide_V1.docx`, `VirCom_Setup_Walkthrough.docx` and `Deye Hybrid Inverter 8K registers.xlsx`.
