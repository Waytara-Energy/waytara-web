# EV charger through the monitoring unit (SIM + local Wi-Fi): checklist

Goal: the ESP gateway goes online by SIM, keeps solar working through the inverter, and opens its own Wi-Fi network for the EV charger. The charger connects to the unit by a `ws://` address, and the unit passes its messages to WayTara over the existing sealed MQTT. Every device behind the unit (inverter, charger) gets the same heartbeat and the same online/offline status in Supabase.

Status 2026-10-23: backend, database and setup page are deployed; the fixed firmware is built (`d4db809`) and waits to be flashed.

## A. Unit firmware (ESP on the USB cable)
- [ ] Flash the fixed build (Wi-Fi radio off in SIM mode, charger network = access point only, any address path accepted)
- [ ] Hub link connects over the SIM with the charger network on (Status: "Internet: SIM", memory lowest value >= 8 KB, also with a phone on Bluetooth)
- [ ] Setup page, EV chargers: create the connection, copy the Wi-Fi name, password and the `ws://192.168.4.1:8080/ocpp/WT-05D0` address
- [ ] Charger: unplug the Ethernet, join the unit's Wi-Fi, set the server address, restart the charger
- [ ] Unit log shows the charger connecting; the five setup-page tests pass (network, boot, heartbeat/status, meter values, WayTara receives it)

## B. Backend and data
- [ ] Replay the real charger log from the Python server (`EV Web Socket/ocpp_server_log.jsonl`) through the backend: every call answered, session and samples stored
- [ ] Same heartbeat for every device behind the unit: while the unit's 10-second heartbeat is alive, its connected charger is reported at the same rhythm; the status verdict (online / charger not answering / unit offline) uses the same cause-aware logic as the inverter
- [ ] Remote start, stop (and target kWh) from the dashboard reach the charger through the unit
- [ ] A charge shows power, current, voltage, energy in the dashboard; solar/battery/grid split is filled in
- [ ] Unit offline or charger unplugged: status and e-mails read correctly and recover by themselves

## C. Dashboard pages (designed and built one by one)
- [ ] 1. Charger overview (status, live power, connector state, start/stop with target kWh)
- [ ] 2. Live charging (kW, A, V, energy, solar share, timer)
- [ ] 3. Sessions (list, detail, export, cost)
- [ ] 4. Charger health (online through which unit, last message, firmware, heartbeat history)
- [ ] 5. Charger settings (name, current limit, later: solar-surplus charging)

## D. Go-live checks
- [ ] ESP back on the inverter RS485: solar readings match the inverter display, no gaps
- [ ] 24-hour run over the SIM: no restarts, data use per day measured, hub link stays up
- [ ] Setup page flows still work (Bluetooth, Network incl. SIM, claim, Push interval)
- [ ] Old firmware restore note kept (`backups/RESTORE-esp32-office-before-sim-20261023.txt`)

## E. Cleanup
- [ ] Remove test rows and test equipment; docs updated (runbook: SIM, charger network, restore)
