# EV charger through the monitoring unit (SIM + local Wi-Fi): checklist

Goal: the ESP gateway goes online by SIM, keeps solar working through the inverter, and opens its own Wi-Fi network for the EV charger. The charger connects to the unit by a `ws://` address, and the unit passes its messages to WayTara over the existing sealed MQTT. Every device behind the unit (inverter, charger) gets the same heartbeat and the same online/offline status in Supabase.

Legend: `[x]` done and checked as described; `[ ]` not done or not checked yet. A note after an item says what was and was not seen.

Status 2026-10-24 (morning, ESP on the PC): backend, database and setup page are deployed. The fixed firmware is flashed on the office unit (the charger network now starts only after the hub link is up). The unit is online by SIM and its readings reach Supabase. Open: memory headroom is too low (7 KB free, lowest 3.1 KB; target 8 KB or more), the unit shows 0 acknowledgements, and the real charger has not connected yet.

## A. Unit firmware (ESP on the USB cable)
- [x] Flash the fixed build (Wi-Fi radio off in SIM mode, charger network = access point only, any address path accepted, charger network started after the hub link). Flashed and hash-verified 2026-10-24; source commit pending
- [ ] Hub link connects over the SIM with the charger network on (Status: "Internet: SIM", memory lowest value >= 8 KB, also with a phone on Bluetooth). Connects and sends data; memory is NOT enough yet (free 7060 B, lowest 3140 B) and no phone was tried
- [x] Setup page, EV chargers: create the connection, copy the Wi-Fi name, password and the `ws://192.168.4.1:8080/ocpp/WT-05D0` address. Done on the unit (charger network `WAYTARA-EV-05D0` is up)
- [ ] Charger: unplug the Ethernet, join the unit's Wi-Fi, set the server address, restart the charger
- [ ] Unit log shows the charger connecting; the five setup-page tests pass (network, boot, heartbeat/status, meter values, WayTara receives it)

## B. Backend and data
- [x] Replay the real charger log from the Python server (`EV Web Socket/ocpp_server_log.jsonl`) through the backend: every call answered, session and samples stored. Done in the backend tests (624/624 pass); not against the live hub
- [ ] Same heartbeat for every device behind the unit: while the unit's 10-second heartbeat is alive, its connected charger is reported at the same rhythm; the status verdict (online / charger not answering / unit offline) uses the same cause-aware logic as the inverter. Built and tested; not seen live with a connected charger
- [ ] Remote start, stop (and target kWh) from the dashboard reach the charger through the unit
- [ ] A charge shows power, current, voltage, energy in the dashboard; solar/battery/grid split is filled in. Shown with sample data only, not from the real charger
- [ ] Unit offline or charger unplugged: status and e-mails read correctly and recover by themselves. An offline e-mail arrived; the recovery and the charger-unplugged case were not checked

## C. Dashboard pages (designed and built one by one)
Built and looked at in the browser with sample data (the real charger has not sent anything yet).
- [x] 1. Charger overview (status, live power, connector state, start/stop with target kWh) - the Overview energy flow and the EV circle/Start button
- [x] 2. Live charging (kW, A, V, energy, solar share, timer) - Monitoring > EV
- [x] 3. Sessions (list, detail, export, cost) - Monitoring (today), Performance and Reports (periods, CSV and PDF downloads), session detail
- [x] 4. Charger health (online through which unit, last message, firmware, heartbeat history) - Maintenance
- [ ] 5. Charger settings (name, current limit, later: solar-surplus charging). The "OCPP and charger" section on Devices shows the connection, controls and (for staff) the configuration; name, current limit and solar-surplus charging are not built, and the configuration needs the backend routes to be deployed

## D. Go-live checks
- [ ] ESP back on the inverter RS485: solar readings match the inverter display, no gaps. The inverter answers over RS485 with the unit on the PC (100% of requests ok); the readings were not compared with the inverter display
- [ ] 24-hour run over the SIM: no restarts, data use per day measured, hub link stays up
- [ ] Setup page flows still work (Bluetooth, Network incl. SIM, claim, Push interval). Not retested with this build
- [x] Old firmware restore note kept (`backups/RESTORE-esp32-office-before-sim-20261023.txt`). Backup checksums verified, files read-only, old commit tagged `fw-0.3.0-t16e-before-sim`

## E. Cleanup
- [ ] Remove test rows and test equipment; docs updated (runbook: SIM, charger network, restore). The runbook is being written; the sample EV data is still in the database on purpose
