# Gateway runbook: SIM internet and EV charger (firmware `waytara-gateway-fw-sim`)

Status 2026-10-24. What is **verified** is marked so; everything else is open. For the task list see `EV_GATEWAY_CHECKLIST.md`.

## 1. What it is
The office unit (ESP32-S3, Waveshare RS485/CAN board) goes online through an A7670C SIM module, keeps reading the Deye inverter over RS485, and opens its own Wi-Fi network for an EV charger. The charger speaks OCPP 1.6-J to the unit by `ws://`; the unit forwards its messages to WayTara over the existing sealed MQTT (`up/ocpp`, `dn/ocpp`). The firmware is a separate copy (`esp32 scripts/waytara-gateway-fw-sim`, branch `feat/gateway-sim`); the old firmware folder is untouched.

## 2. Wiring (from `config.h`)
| Link | ESP32-S3 pin | Other end |
|---|---|---|
| SIM module (UART2) | GPIO1 = ESP TX (`CELL_TX_PIN`) | module RX |
| SIM module (UART2) | GPIO2 = ESP RX (`CELL_RX_PIN`) | module TX |
| SIM module power | 3V3 | VDD |
| SIM module ground | GND | GND |
| Inverter (UART1, RS485, 9600 baud, slave 1) | TX 17, RX 18, enable 21 | A/B to the Deye |
No module reset/power-key pin is wired (`CELL_RST_PIN -1`). SIM: Airtel, APN `airtelgprs.com`.

## 3. Internet source
Console `uplink wifi | sim <apn> [pin] | auto <apn> [pin]` (restarts). `auto` uses Wi-Fi when a saved network is in range and the SIM otherwise. With `sim`, Wi-Fi is off, which keeps internal memory free. The setup page shows it inside Network ("Internet: SIM").

## 4. The charger network
- Wi-Fi name `WAYTARA-EV-<last 4 of the hardware id>` (office unit: `WAYTARA-EV-05D0`), the unit is `192.168.4.1`.
- Address for the charger: `ws://192.168.4.1:8080/ocpp/<charger name>` (office: `WT-05D0`). **Any path is accepted** (a charger may append its own name).
- Password: shown on the setup page, EV chargers (or console `ev status`). Not written here.
- Set up: setup page (Network > Internet, then EV chargers) or console `ev on <name>`; `ev off` removes it. The charger needs the address typed into its own app; the setup page cannot write it into the charger.
- It only works with the SIM as the internet source (`ev_open` refuses otherwise).

## 5. Start order and memory (why)
The hub link's TLS needs about 45 KB of **internal** RAM in pieces (two contiguous 16 KB buffers); this core build keeps mbedtls in internal RAM (`MBEDTLS_INTERNAL_MEM_ALLOC`). The charger access point and server take memory the TLS needs, so the charger network now **starts only after the hub link is up** (`evTick`), and Wi-Fi stays off in SIM mode.
- Verified 2026-10-24: with this order the hub link connects over the SIM and the charger network comes up.
- **Open (found right after the flash):** internal free was only ~7 KB (largest block 4.3 KB, lowest ever 3.1 KB). The target is lowest-ever >= 8 KB, so this is not met yet. Planned: measure, start guard, free memory in the heartbeat, Bluetooth on demand, later a custom core with TLS in PSRAM (~7 MB free).

## 6. Reading the unit
Serial console, 115200: `status` (firmware, SIM and signal, memory, hub link, inverter, frames sent/acknowledged), `ev status` (network, charger connected, boots/heartbeats/meter values). Setup-page tests for the charger are on the EV chargers page.
**Open:** frames were sent but `acknowledged` stayed 0 right after the flash; to be checked.

## 7. Flashing (office board, COM4)
Close the Arduino IDE (it holds the port). `esptool` 5.3.1 from `%LOCALAPPDATA%\Arduino15\packages\esp32\tools\esptool_py`, `--baud 115200`; FQBN `esp32:esp32:esp32s3:FlashSize=16M,PartitionScheme=app3M_fat9M_16MB,PSRAM=opi,CDCOnBoot=cdc,UploadSpeed=115200`. Write **only the app** to `0x10000` (`write-flash 0x10000 waytara-gateway-fw-sim.ino.bin`): the settings, key and claim stay. A compile takes 10-25 minutes.

## 8. Restoring the old firmware (0.3.0-t16e)
- Backup and exact command: `D:\Manoj-Waytara\backups\RESTORE-esp32-office-before-sim-20261023.txt` (files are read-only, md5 checked 2026-10-24; they hold the unit's key, never commit).
- Source: git tag `fw-0.3.0-t16e-before-sim` (commit `d995839`) in the `esp32 scripts` repo.

## 9. Backend and database
- Backend (`waytara-backend`): `OcppBridge` (virtual sockets into the OCPP engine); routes `GET/POST/DELETE /v1/ev/gateways/:gateway/chargers`. Deployed on Render (earlier commit). **Pending deploy:** `GET/POST /v1/ev/:equipment/configuration` (commit `50218b8`) and the unit-heartbeat/cause-aware status commit `d1cf6eb`; they need a push and a manual Render redeploy.
- Database (applied live): table `gateway_chargers` and its `gw_*` functions (`20261024020000_gateway_chargers.sql`), audit actor fix (`...030000`), activity cause (`...010000`).
- Office charger: equipment `b63f7d02-42d0-493b-a6e5-7620f4e94393`, name `WT-05D0`, linked to the office unit `b4c30eb8-fba4-4487-aa7a-3c1b089e36e2`.

## 10. Dashboard
EV pages (customer dashboard): Overview (charger circle starts a charge), Monitoring > EV, Performance, Reports (CSV/PDF), Maintenance (charger health), Devices > OCPP and charger. Not yet seen with a real charger.

## 11. Sample data
`D:\Manoj-Waytara\EV Web Socket\sample-data`: `ev_seed.sql`, `ev_live.sql`, `ev_events_extra.sql` (all `is_test`/simulated); `cleanup.sql` removes it. Performance and Reports show sample sessions, labelled, only while the charger has no real session.
