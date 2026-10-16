# WayTara gateway: running it in production

What is deployed, what must be set, how to tell it is healthy, how to undo things, and the order of the first hardware tests.
Design and reasons: `GATEWAY_ARCHITECTURE_V2.md`. No secret appears in this file; each one is named with the place it lives.

## 1. What runs where

| Part | Where | Address |
|---|---|---|
| Backend (Fastify, MQTT broker, OCPP server, cadence reports) | Render, service `waytara-backend`, repo `waytara-backend` (branch `main`) | `https://hub.waytaraenergy.com` |
| Database | Supabase project `yxenvzcfypfqzbpfyuiz`, schema `waytara` | |
| Cadence files (every reading, 28 days) | Cloudflare R2 bucket `waytara-cadence` (lifecycle rule: delete after 30 days, prefix `cadence/`) | |
| Customer dashboard | Vercel, `apps/web`, branch `feat/gateway-foundation` of the dashboard repo until merged | |
| Staff dashboard | Vercel, `apps/admin` | |
| Monitoring unit (ESP32-S3) | at the site; firmware in the `esp32 scripts` repo, branch `feat/gateway-fw`, folder `waytara-gateway-fw` | MQTT over `wss://hub.waytaraenergy.com/mqtt` |
| EV charger (Plugzmart) | at the site | OCPP 1.6-J over `wss://hub.waytaraenergy.com/ocpp/<secret>/<name>` |

## 2. Settings that must exist

**Render (service environment).** Names only; values live in your password manager.

| Name | Notes |
|---|---|
| `NODE_ENV=production`, `TRUST_PROXY=true` | |
| `PUBLIC_BASE_URL` | `https://hub.waytaraenergy.com` |
| `ALLOWED_ORIGINS` | every website that calls the API from a browser, origin only, https, no trailing slash: **the customer dashboard, the staff dashboard and the setup page**. A missing one shows up as "Could not reach the service" on the Cadence, Reports and Device keys pages. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_USER_EMAIL`, `SUPABASE_SERVICE_USER_PASSWORD` | The backend signs in as its own service user. It never holds the `service_role` key. |
| `KEY_ENCRYPTION_MASTER` | 32 random bytes, base64. **If lost, every stored key must be re-issued.** Keep a copy in the password manager. |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | All four or none. Token limited to the bucket (Object Read & Write). |
| `GATEWAY_INGEST`, `OCPP_ENABLED` | Both on by default; `false` switches the part off. |

**Vercel (both dashboards).** `NEXT_PUBLIC_GATEWAY_URL=https://hub.waytaraenergy.com` (the default if unset).

**Supabase.** Migrations are in `packages/supabase/supabase/migrations/`; the latest are `20261015…` (gateway) and `20261016000000_ev_ocpp.sql`. The database tests in `…/tests/database/` (17, 18, 19 for the gateway) run inside a rolled-back transaction.

## 3. Keeping it awake (Render free plan)

The free plan puts a service to sleep after 15 minutes without web traffic. A sleeping hub means the unit loses its connection and reconnects only after a slow cold start, and data waits in the unit's buffer. Until the service is on a paid plan:

1. Make a free monitor at UptimeRobot (or similar): HTTP(s), `https://hub.waytaraenergy.com/healthz`, every 5 minutes.
2. Add a second monitor on `https://hub.waytaraenergy.com/readyz`. It checks the database and the file store, so it shows trouble `/healthz` does not.
3. Send the alerts to your phone.

The unit keeps the readings it has not had acknowledged in a 1 MB buffer and sends them once the hub is back, so a short sleep loses nothing. How long the buffer lasts has not been measured yet; once it is full the oldest readings are dropped.

## 4. Is it healthy?

| Question | Where to look |
|---|---|
| Is the service up and its dependencies fine? | `GET /readyz` (200 with every check "ok") |
| Is a unit connected? | Dashboard header status icon; admin **Devices**; or the `equipment_heartbeat` view. A unit is "offline" after 3 missed 10-second check-ins (minimum 30 s). |
| Is data arriving? | Customer Overview live values; admin **Cadence data** preview of the last minutes |
| Is a charger connected? | Header status icon of the charger; `GET /v1/ev/<id>/status` (signed in) |
| What did the backend log? | Render **Logs**. Secrets are redacted: the first path segment of `/ocpp/<secret>/<name>` and all login tokens never appear. |

## 5. Everyday actions

* **A new unit or charger key**: admin **Device keys**. A unit normally gets its key during Bluetooth setup (claim); use the page for chargers, or to replace/revoke a lost one. A secret is shown once.
* **Replace a charger's secret**: Device keys → Replace → type the new address into the charger's app. With "old one works for 1 more hour" the charger keeps working while you update it.
* **Cut a device off**: Device keys → Revoke. The connection drops within seconds.
* **Rotate `KEY_ENCRYPTION_MASTER`**: set the new value, put the old one in `KEY_ENCRYPTION_MASTER_PREVIOUS`, redeploy, then replace keys at leisure.
* **Remote start / stop / reset / unlock of a charger**: `POST /v1/ev/<id>/remote-start|remote-stop|reset|unlock|trigger` with a staff or owner sign-in (there is no button yet).

## 6. Undoing things

| Change | How to undo |
|---|---|
| A bad backend deploy | Render → Deploys → pick the last good one → **Rollback**. The database is never changed by a deploy. |
| A bad dashboard deploy | Vercel → Deployments → promote the previous one. |
| A bad migration | The newer migration files end with their own rollback section; run it with `npx supabase db query --linked --file …` inside a `begin; … commit;`. |
| The unit's new firmware | The old firmware image was backed up from the office board (md5-verified); restoring it is a flash with `esptool --no-stub` (the stub flasher fails on this board at 0x5E000). Over-the-air update with automatic rollback comes with A11. |
| A charger pointed at the hub | Put its previous address back in the charger's app. Nothing at the hub has to change. |
| Switching the hub's parts off | `GATEWAY_INGEST=false` (no broker, no intake), `OCPP_ENABLED=false` (no chargers); key and claim endpoints stay. |

## 7. Security checklist (state on 2026-10-15)

* Unit ⇄ hub: MQTT over TLS, login token derived one way from the key; every message sealed (AES-256-GCM, per-equipment, per-direction key, counter against replay). A unit can publish and subscribe only to its own topics. ✔ tested live
* Charger ⇄ hub: TLS, the secret is in the address (the charger's app has one field), unknown address → plain 404 before any upgrade, one connection per charger, rate limits. ✔ tested live with a simulated charger
* Keys: encrypted at rest with `KEY_ENCRYPTION_MASTER`; browsers can list fingerprints but not read ciphertext (column grants). ✔ database tests
* Backend → database: its own low-privilege user, `gw_*` functions only; no `service_role`. ✔
* Customers: see only their own sites' sessions, samples and events (RLS); cadence data only on a plan with the reports feature. ✔ database tests 17–19
* Logs and errors never contain a secret, a token or a request body. ✔ tests
* Not done yet: the board's secure-boot and flash-encryption (irreversible; needs a spare board, A11), signed commands for settings write-back (A9), raw OCPP frame log.

## 8. First hardware tests (in this order)

**Before you start:** the iPhone hotspot on, Arduino IDE closed (it holds the USB port and restarts the board), the board on USB.

### 8.1 Inverter over RS485 (morning)

1. Power the inverter side safely: connect the board's **A/B** terminals to the inverter's RS485 port (A to A/D+, B to B/D−, plus a ground wire if the inverter has one). Settings in the firmware: 9600 baud, 8N1, slave address 1. Wrong polarity only gives no answer; swap A and B.
2. In the serial terminal: `sim off` (the board now reads the RS485 line), then `status`.
3. Expect within a minute: "inverter: online", a rising "rounds" count, and few failed requests.
4. In the dashboard: Overview live values match the inverter's own screen (PV power, battery, grid, load). Admin **Cadence data** shows the same numbers for the last minutes.
5. After the next quarter-hour boundary: the 15-minute summary appears in Performance, and the board's first acknowledgement shows in `status`.
6. If values are wrong by a factor (10, 100) or sign: do not change the board; tell me which value on which screen and I correct the catalogue (raw words are stored, so history is corrected too).

### 8.2 EV charger (after 8.1 passes)

1. Admin **Device keys** → the charger → **Make a key**. Copy the address (it is shown once).
2. Type it into the Plugzmart app as the server address (OCPP 1.6-J). If the app refuses `wss://…/ocpp/<secret>/<name>` or insists on port 9220, tell me what it accepts: that decides route A, B or C of the plan.
3. The charger's header icon turns green within a minute. Start a charge from the charger; stop it after a few minutes.
4. Customer **Charging sessions** shows the session: energy equals the charger's display (±0.01 kWh), the curve, and the solar/battery/grid split if the inverter was reporting.

## 9. Known gaps (so nothing is a surprise)

* The new pages (Charging sessions, Device keys, Cadence tab) have been built, type-checked and compiled, but not yet looked at in a browser with a real sign-in.
* Settings write-back (A9) is not built. The setup page (A7, repository `ESP32-S3-GUI`) is built and tested against a fake unit in a real browser, but not yet against the real board over Bluetooth, and not yet deployed (it needs a Vercel project, see the README of the `ESP32-S3-GUI` repository); until then the serial helper and `tools/setup-test.html` still work.
* The BOOT-button recovery window and the unit's restart after a setup session have not been exercised on the board.
* Render free plan: needs the monitor in section 3 until the plan is upgraded.
* The Ola Maps key was exposed earlier and lives on a personal account: rotate it and move it to a company account.
