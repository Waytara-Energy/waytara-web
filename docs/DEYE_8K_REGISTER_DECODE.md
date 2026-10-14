# Deye 8K (SUN-8K-SG05LP1-EU-AM2-P) register decode formulas

Device: **Deye 8kW Hybrid Inverter** at **Waytara Office** (equipment id `b4c30eb8-fba4-4487-aa7a-3c1b089e36e2`). Generated 2026-10-12 from the live `waytara.equipment_metrics` rows (406 read, 66 write, 2 platform actions) and cross-checked against the register-discovery sweep of 10 Sep 2026 (`Deye Hybrid Inverter 8K registers.xlsx`).

**Where this runs:** decoding belongs in the backend server only. The ESP32 reads raw 16-bit words and sends them untouched with their register numbers; the backend applies the rules below, checks the range, and only then writes to Supabase. Today the decode runs in the Python `equipment_agent` (`codec.py`), which reads the same `equipment_metrics` rows.

## 1. The bus

| | |
|---|---|
| Port | RJ45 socket **8 "Modbus"** on the inverter (not 7 "RS 485/METER", not 6 "BMS 485/CAN") |
| Pins | 1 = B, 2 = A, 3 = GND (pins 8 = B, 7 = A, 6 = GND are the same lines); signal names `sunspec-485_A/B` in the manual |
| Serial | 9600 baud, 8 data bits, no parity, 1 stop bit (8N1) |
| Slave id | 1 (inverter LCD: Advanced Function, "Modbus SN") |
| Protocol | Modbus RTU. Function **0x03** read holding registers, **0x06** write one register, **0x10** write several |
| Word | 16-bit big-endian per register; a 32-bit value is two registers |

## 2. Decode rules

Every rule starts from the raw unsigned 16-bit word `R<n>` of register n.

| Rule in the catalogue | Meaning | Formula |
|---|---|---|
| `scale` | multiply | `value = R × scale` |
| `offset` | add after scaling | `value = R × scale + offset` (temperatures: `R × 0.1 − 100`) |
| `signed` | two's complement | `R ≥ 32768 ? R − 65536 : R`, then scale |
| `combine: low_high_word` | 32-bit counter | `value = (R_low + R_high × 65536) × scale`. `low_word_register` says which register is the low word |
| `bitmask` | a field inside a register | `(R & mask) >> trailing_zero_bits(mask)`; then enum / bool |
| `enum_ref` | a code with a name | look the number up in `waytara.equipment_enum` (section 7) |
| `note` | special packing | ASCII, HHMM or packed date; see the note on the row |
| no rule | the number as it is | `value = R` |

**Writing is the exact inverse:** `R = (value − offset) / scale`, rounded, converted to two's complement when `signed`; a bit field is written by **read-modify-write** of its register (read R, `R = (R & ~mask) | (field << shift)`, write R), then **read it back** and compare. A write is only sent for a metric that has `direction = write`, passes `valid_min/valid_max`, and is on the allow-list the customer's plan permits (section 6).

### Special cases

* **Serial number (R3 to R7):** 10 ASCII characters, 2 per register, high byte first.
* **Inverter date and time (R22 to R24):** R22 = (year − 2000) in the high byte and month in the low byte; R23 = day / hour; R24 = minute / second.
* **Time-of-use slot times (R250 to R255):** HHMM as a decimal number: `2359` is 23:59 (`hour = v div 100`, `minute = v mod 100`). The web page stores them as digits (`100` is 01:00).
* **Warning words (R101, R102) and fault words (R103 to R106):** each bit is one code. Bit 0 of R103 is F01 and bit 15 is F16; R104 is F17 to F32, R105 F33 to F48, R106 F49 to F64; the warning words give W01 to W16 and W17 to W32. **Decode the bit set, never the word as a number** (see "Findings").
* **Alarm words (R117, R118):** bit fields of the same kind, handled like the warning words.

## 3. Read registers (406)

Grouped by dashboard category; sorted by register. "Every" is the cadence the agent reads it at. Rows with an empty Reg are **derived** by the platform from other values, never read from the inverter.

### Alerts (11)

| Key | Name | Reg | Formula | Unit | Valid range | Every | Notes |
|---|---|---|---|---|---|---|---|
| `warning_message_1` | Warning Word 1 | 101 | R101 |  |  | 10 s | Reg 101 warning message word 1; decoded against the W-code table (W01-W04). |
| `warning_message_2` | Warning Word 2 | 102 | R102 |  |  | 10 s | Reg 102 warning message word 2. |
| `fault_message_1` | Fault Word 1 | 103 | R103 |  |  | 10 s | Reg 103 fault information word 1; decoded against the F-code table (pages 44-46). |
| `fault_message_2` | Fault Word 2 | 104 | R104 |  |  | 10 s | Reg 104 fault information word 2; decoded against the F-code table (pages 44-46). |
| `fault_message_3` | Fault Word 3 | 105 | R105 |  |  | 10 s | Reg 105 fault information word 3; decoded against the F-code table (pages 44-46). |
| `fault_message_4` | Fault Word 4 | 106 | R106 |  |  | 10 s | Reg 106 fault information word 4; decoded against the F-code table (pages 44-46). |
| `alarm_status_1` | Alarm Status 1 | 117 | R117 |  |  | 10 s | Reg 117 'Alarms Status1' (V119 real-time area). Raw bitmask; bit meanings not documented in the PDF. |
| `alarm_status_2` | Alarm Status 2 | 118 | R118 |  |  | 10 s | Reg 118 (listed in the PDF as 'Alarms Status1' again — second alarm word). Raw bitmask. |
| `fault_history` | Fault History | 1000 | R1000 |  |  | 1 h | Memory record table, regs 1000-1499 (inverter fault log, 500 words). Read as one block; address lists only the start register. |
| `fault_history` | Fault History | 1000 | R1000 | list |  | 1 h | Memory record table, regs 1000-1499 (inverter fault log, 500 words). Read as one block; address lists only the start register. |
| `active_alerts` | Active Alerts |  | Derived by the platform (see Notes) |  |  | 10 s | Derived by the platform — decodes warning words (101-102) and fault words (103-106) with the Deye W-/F-code table; no register of its own. |

### Battery (184)

| Key | Name | Reg | Formula | Unit | Valid range | Every | Notes |
|---|---|---|---|---|---|---|---|
| `day_battery_charge_energy_kwh` | Charged Today | 70 | (R70) × 0.1 | kWh |  | 30 s | Reg 70 day battery charge energy, 0.1 kWh. |
| `day_battery_discharge_energy_kwh` | Discharged Today | 71 | (R71) × 0.1 | kWh |  | 30 s | Reg 71 day battery discharge energy, 0.1 kWh. |
| `battery_temperature_c` | Battery Temperature | 182 | (R182) × 0.1 | °C | -100 … 200 | 30 s | Reg 182 battery temperature, plain 0.1 C with NO offset. Verified on the real SUN-8K 2026-10-05: raw 300 = 30.0 C, matching the BMS temperature (reg 319). The PDF text suggests a +1000 offset, but this firmware does not apply it. |
| `battery_voltage_v` | Battery Voltage | 183 | (R183) × 0.01 | V |  | 5 s | Reg 183 battery voltage, 0.01 V (4100 = 41.00 V). |
| `battery_charge_status` | Battery Charge Status | 185 | R185 |  |  | 5 s | Reg 185 'battery status'. The PDF does not tabulate its values; no enum attached. |
| `battery_current_a` | Battery Current | 191 | (int16(R191)) × 0.01 | A |  | 5 s | Reg 191 battery output current, signed int16, 0.01 A. |
| `bms_charge_voltage_v` | BMS Charge Voltage | 312 | (R312) × 0.01 | V |  | 30 s | Reg 312 BMS charging voltage, 0.01 V. |
| `bms_discharge_voltage_v` | BMS Discharge Voltage | 313 | (R313) × 0.01 | V |  | 30 s | Reg 313 BMS discharge voltage, 0.01 V. |
| `bms_charge_current_limit_a` | BMS Charge Current Limit | 314 | R314 | A |  | 30 s | Reg 314 BMS charging current limit, 1 A. |
| `bms_discharge_current_limit_a` | BMS Discharge Current Limit | 315 | R315 | A |  | 30 s | Reg 315 BMS discharge current limiting, 1 A. |
| `bms_soc_pct` | BMS State of Charge | 316 | R316 | % | 0 … 100 | 30 s | Reg 316 BMS real-time capacity, 1 %. |
| `bms_voltage_v` | BMS Voltage | 317 | (R317) × 0.01 | V |  | 30 s | Reg 317 BMS real-time voltage, 0.01 V. |
| `bms_current_a` | BMS Current | 318 | int16(R318) | A |  | 30 s | Reg 318 BMS real-time current, 1 A, signed (PDF lists no sign; treated signed as in the previous seed). |
| `bms_temperature_c` | BMS Temperature | 319 | (R319) × 0.1 − 100 | °C | -100 … 200 | 30 s | Reg 319 BMS real-time temperature, 0.1 C, offset +1000 (1000 = 0 C, 800 = -20 C). [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `bms_max_charge_current_limit_a` | BMS Max Charge Current Limit | 320 | R320 | A |  | 30 s | Reg 320 BMS maximum charge current limit, 1 A. |
| `bms_max_discharge_current_limit_a` | BMS Max Discharge Current Limit | 321 | R321 | A |  | 30 s | Reg 321 BMS maximum discharge current limit, 1 A. |
| `battery_pack1_voltage_v` | Pack 1 Voltage | 600 | (R600) × 0.01 | V |  | 30 s | Pack 1 module voltage, reg 600, 0.01 V. |
| `battery_pack1_current_a` | Pack 1 Current | 601 | (int16(R601)) × 0.1 | A |  | 30 s | Pack 1 module current, reg 601, 0.1 A (signed assumed: charge/discharge direction). |
| `battery_pack1_temperature_c` | Pack 1 Average Temperature | 602 | (R602) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 1 average temperature, reg 602; '1250 = 25.0 C' => (raw-1000)/10. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack1_soc_pct` | Pack 1 State of Charge | 603 | (R603) × 0.1 | % | 0 … 100 | 30 s | Pack 1 SOC, reg 603; PDF unit column says just '0.1' (assumed 0.1 %). Verify on hardware - if it reads 1 % per count, drop the scale. |
| `battery_pack1_charge_voltage_v` | Pack 1 Charge Voltage | 606 | (R606) × 0.01 | V |  | 30 s | Pack 1 charge voltage, reg 606, 0.01 V. |
| `battery_pack1_charge_current_a` | Pack 1 Charge Current | 607 | (R607) × 0.1 | A |  | 30 s | Pack 1 charge current, reg 607, 0.1 A. |
| `battery_pack1_discharge_current_a` | Pack 1 Discharge Current | 608 | (R608) × 0.1 | A |  | 30 s | Pack 1 discharge current, reg 608, 0.1 A. |
| `battery_pack1_max_cell_voltage_v` | Pack 1 Max Cell Voltage | 609 | (R609) × 0.01 | V |  | 30 s | Pack 1 max cell voltage, reg 609, 0.01 V. |
| `battery_pack1_min_cell_voltage_v` | Pack 1 Min Cell Voltage | 610 | (R610) × 0.01 | V |  | 30 s | Pack 1 min cell voltage, reg 610, 0.01 V. |
| `battery_pack2_voltage_v` | Pack 2 Voltage | 614 | (R614) × 0.01 | V |  | 30 s | Pack 2 module voltage, reg 614, 0.01 V. |
| `battery_pack2_current_a` | Pack 2 Current | 615 | (int16(R615)) × 0.1 | A |  | 30 s | Pack 2 module current, reg 615, 0.1 A (signed assumed: charge/discharge direction). |
| `battery_pack2_temperature_c` | Pack 2 Average Temperature | 616 | (R616) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 2 average temperature, reg 616; '1250 = 25.0 C' => (raw-1000)/10. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack2_soc_pct` | Pack 2 State of Charge | 617 | (R617) × 0.1 | % | 0 … 100 | 30 s | Pack 2 SOC, reg 617; PDF unit column says just '0.1' (assumed 0.1 %). Verify on hardware - if it reads 1 % per count, drop the scale. |
| `battery_pack2_charge_voltage_v` | Pack 2 Charge Voltage | 620 | (R620) × 0.01 | V |  | 30 s | Pack 2 charge voltage, reg 620, 0.01 V. |
| `battery_pack2_charge_current_a` | Pack 2 Charge Current | 621 | (R621) × 0.1 | A |  | 30 s | Pack 2 charge current, reg 621, 0.1 A. |
| `battery_pack2_discharge_current_a` | Pack 2 Discharge Current | 622 | (R622) × 0.1 | A |  | 30 s | Pack 2 discharge current, reg 622, 0.1 A. |
| `battery_pack2_max_cell_voltage_v` | Pack 2 Max Cell Voltage | 623 | (R623) × 0.01 | V |  | 30 s | Pack 2 max cell voltage, reg 623, 0.01 V. |
| `battery_pack2_min_cell_voltage_v` | Pack 2 Min Cell Voltage | 624 | (R624) × 0.01 | V |  | 30 s | Pack 2 min cell voltage, reg 624, 0.01 V. |
| `battery_pack3_voltage_v` | Pack 3 Voltage | 628 | (R628) × 0.01 | V |  | 30 s | Pack 3 module voltage, reg 628, 0.01 V. |
| `battery_pack3_current_a` | Pack 3 Current | 629 | (int16(R629)) × 0.1 | A |  | 30 s | Pack 3 module current, reg 629, 0.1 A (signed assumed: charge/discharge direction). |
| `battery_pack3_temperature_c` | Pack 3 Average Temperature | 630 | (R630) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 3 average temperature, reg 630; '1250 = 25.0 C' => (raw-1000)/10. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack3_soc_pct` | Pack 3 State of Charge | 631 | (R631) × 0.1 | % | 0 … 100 | 30 s | Pack 3 SOC, reg 631; PDF unit column says just '0.1' (assumed 0.1 %). Verify on hardware - if it reads 1 % per count, drop the scale. |
| `battery_pack3_charge_voltage_v` | Pack 3 Charge Voltage | 634 | (R634) × 0.01 | V |  | 30 s | Pack 3 charge voltage, reg 634, 0.01 V. |
| `battery_pack3_charge_current_a` | Pack 3 Charge Current | 635 | (R635) × 0.1 | A |  | 30 s | Pack 3 charge current, reg 635, 0.1 A. |
| `battery_pack3_discharge_current_a` | Pack 3 Discharge Current | 636 | (R636) × 0.1 | A |  | 30 s | Pack 3 discharge current, reg 636, 0.1 A. |
| `battery_pack3_max_cell_voltage_v` | Pack 3 Max Cell Voltage | 637 | (R637) × 0.01 | V |  | 30 s | Pack 3 max cell voltage, reg 637, 0.01 V. |
| `battery_pack3_min_cell_voltage_v` | Pack 3 Min Cell Voltage | 638 | (R638) × 0.01 | V |  | 30 s | Pack 3 min cell voltage, reg 638, 0.01 V. |
| `battery_pack4_voltage_v` | Pack 4 Voltage | 642 | (R642) × 0.01 | V |  | 30 s | Pack 4 module voltage, reg 642, 0.01 V. |
| `battery_pack4_current_a` | Pack 4 Current | 643 | (int16(R643)) × 0.1 | A |  | 30 s | Pack 4 module current, reg 643, 0.1 A (signed assumed: charge/discharge direction). |
| `battery_pack4_temperature_c` | Pack 4 Average Temperature | 644 | (R644) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 4 average temperature, reg 644; '1250 = 25.0 C' => (raw-1000)/10. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack4_soc_pct` | Pack 4 State of Charge | 645 | (R645) × 0.1 | % | 0 … 100 | 30 s | Pack 4 SOC, reg 645; PDF unit column says just '0.1' (assumed 0.1 %). Verify on hardware - if it reads 1 % per count, drop the scale. |
| `battery_pack4_charge_voltage_v` | Pack 4 Charge Voltage | 648 | (R648) × 0.01 | V |  | 30 s | Pack 4 charge voltage, reg 648, 0.01 V. |
| `battery_pack4_charge_current_a` | Pack 4 Charge Current | 649 | (R649) × 0.1 | A |  | 30 s | Pack 4 charge current, reg 649, 0.1 A. |
| `battery_pack4_discharge_current_a` | Pack 4 Discharge Current | 650 | (R650) × 0.1 | A |  | 30 s | Pack 4 discharge current, reg 650, 0.1 A. |
| `battery_pack4_max_cell_voltage_v` | Pack 4 Max Cell Voltage | 651 | (R651) × 0.01 | V |  | 30 s | Pack 4 max cell voltage, reg 651, 0.01 V. |
| `battery_pack4_min_cell_voltage_v` | Pack 4 Min Cell Voltage | 652 | (R652) × 0.01 | V |  | 30 s | Pack 4 min cell voltage, reg 652, 0.01 V. |
| `battery_pack5_voltage_v` | Pack 5 Voltage | 656 | (R656) × 0.01 | V |  | 30 s | Pack 5 module voltage, reg 656, 0.01 V. |
| `battery_pack5_current_a` | Pack 5 Current | 657 | (int16(R657)) × 0.1 | A |  | 30 s | Pack 5 module current, reg 657, 0.1 A (signed assumed: charge/discharge direction). |
| `battery_pack5_temperature_c` | Pack 5 Average Temperature | 658 | (R658) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 5 average temperature, reg 658; '1250 = 25.0 C' => (raw-1000)/10. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack5_soc_pct` | Pack 5 State of Charge | 659 | (R659) × 0.1 | % | 0 … 100 | 30 s | Pack 5 SOC, reg 659; PDF unit column says just '0.1' (assumed 0.1 %). Verify on hardware - if it reads 1 % per count, drop the scale. |
| `battery_pack5_charge_voltage_v` | Pack 5 Charge Voltage | 662 | (R662) × 0.01 | V |  | 30 s | Pack 5 charge voltage, reg 662, 0.01 V. |
| `battery_pack5_charge_current_a` | Pack 5 Charge Current | 663 | (R663) × 0.1 | A |  | 30 s | Pack 5 charge current, reg 663, 0.1 A. |
| `battery_pack5_discharge_current_a` | Pack 5 Discharge Current | 664 | (R664) × 0.1 | A |  | 30 s | Pack 5 discharge current, reg 664, 0.1 A. |
| `battery_pack5_max_cell_voltage_v` | Pack 5 Max Cell Voltage | 665 | (R665) × 0.01 | V |  | 30 s | Pack 5 max cell voltage, reg 665, 0.01 V. |
| `battery_pack5_min_cell_voltage_v` | Pack 5 Min Cell Voltage | 666 | (R666) × 0.01 | V |  | 30 s | Pack 5 min cell voltage, reg 666, 0.01 V. |
| `battery_pack6_voltage_v` | Pack 6 Voltage | 670 | (R670) × 0.01 | V |  | 30 s | Pack 6 module voltage, reg 670, 0.01 V. |
| `battery_pack6_current_a` | Pack 6 Current | 671 | (int16(R671)) × 0.1 | A |  | 30 s | Pack 6 module current, reg 671, 0.1 A (signed assumed: charge/discharge direction). |
| `battery_pack6_temperature_c` | Pack 6 Average Temperature | 672 | (R672) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 6 average temperature, reg 672; '1250 = 25.0 C' => (raw-1000)/10. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack6_soc_pct` | Pack 6 State of Charge | 673 | (R673) × 0.1 | % | 0 … 100 | 30 s | Pack 6 SOC, reg 673; PDF unit column says just '0.1' (assumed 0.1 %). Verify on hardware - if it reads 1 % per count, drop the scale. |
| `battery_pack6_charge_voltage_v` | Pack 6 Charge Voltage | 676 | (R676) × 0.01 | V |  | 30 s | Pack 6 charge voltage, reg 676, 0.01 V. |
| `battery_pack6_charge_current_a` | Pack 6 Charge Current | 677 | (R677) × 0.1 | A |  | 30 s | Pack 6 charge current, reg 677, 0.1 A. |
| `battery_pack6_discharge_current_a` | Pack 6 Discharge Current | 678 | (R678) × 0.1 | A |  | 30 s | Pack 6 discharge current, reg 678, 0.1 A. |
| `battery_pack6_max_cell_voltage_v` | Pack 6 Max Cell Voltage | 679 | (R679) × 0.01 | V |  | 30 s | Pack 6 max cell voltage, reg 679, 0.01 V. |
| `battery_pack6_min_cell_voltage_v` | Pack 6 Min Cell Voltage | 680 | (R680) × 0.01 | V |  | 30 s | Pack 6 min cell voltage, reg 680, 0.01 V. |
| `battery_pack7_voltage_v` | Pack 7 Voltage | 684 | (R684) × 0.01 | V |  | 30 s | Pack 7 module voltage, reg 684, 0.01 V. |
| `battery_pack7_current_a` | Pack 7 Current | 685 | (int16(R685)) × 0.1 | A |  | 30 s | Pack 7 module current, reg 685, 0.1 A (signed assumed: charge/discharge direction). |
| `battery_pack7_temperature_c` | Pack 7 Average Temperature | 686 | (R686) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 7 average temperature, reg 686; '1250 = 25.0 C' => (raw-1000)/10. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack7_soc_pct` | Pack 7 State of Charge | 687 | (R687) × 0.1 | % | 0 … 100 | 30 s | Pack 7 SOC, reg 687; PDF unit column says just '0.1' (assumed 0.1 %). Verify on hardware - if it reads 1 % per count, drop the scale. |
| `battery_pack7_charge_voltage_v` | Pack 7 Charge Voltage | 690 | (R690) × 0.01 | V |  | 30 s | Pack 7 charge voltage, reg 690, 0.01 V. |
| `battery_pack7_charge_current_a` | Pack 7 Charge Current | 691 | (R691) × 0.1 | A |  | 30 s | Pack 7 charge current, reg 691, 0.1 A. |
| `battery_pack7_discharge_current_a` | Pack 7 Discharge Current | 692 | (R692) × 0.1 | A |  | 30 s | Pack 7 discharge current, reg 692, 0.1 A. |
| `battery_pack7_max_cell_voltage_v` | Pack 7 Max Cell Voltage | 693 | (R693) × 0.01 | V |  | 30 s | Pack 7 max cell voltage, reg 693, 0.01 V. |
| `battery_pack7_min_cell_voltage_v` | Pack 7 Min Cell Voltage | 694 | (R694) × 0.01 | V |  | 30 s | Pack 7 min cell voltage, reg 694, 0.01 V. |
| `battery_pack8_voltage_v` | Pack 8 Voltage | 698 | (R698) × 0.01 | V |  | 30 s | Pack 8 module voltage, reg 698, 0.01 V. |
| `battery_pack8_current_a` | Pack 8 Current | 699 | (int16(R699)) × 0.1 | A |  | 30 s | Pack 8 module current, reg 699, 0.1 A (signed assumed: charge/discharge direction). |
| `battery_pack8_temperature_c` | Pack 8 Average Temperature | 700 | (R700) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 8 average temperature, reg 700; '1250 = 25.0 C' => (raw-1000)/10. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack8_soc_pct` | Pack 8 State of Charge | 701 | (R701) × 0.1 | % | 0 … 100 | 30 s | Pack 8 SOC, reg 701; PDF unit column says just '0.1' (assumed 0.1 %). Verify on hardware - if it reads 1 % per count, drop the scale. |
| `battery_pack8_charge_voltage_v` | Pack 8 Charge Voltage | 704 | (R704) × 0.01 | V |  | 30 s | Pack 8 charge voltage, reg 704, 0.01 V. |
| `battery_pack8_charge_current_a` | Pack 8 Charge Current | 705 | (R705) × 0.1 | A |  | 30 s | Pack 8 charge current, reg 705, 0.1 A. |
| `battery_pack8_discharge_current_a` | Pack 8 Discharge Current | 706 | (R706) × 0.1 | A |  | 30 s | Pack 8 discharge current, reg 706, 0.1 A. |
| `battery_pack8_max_cell_voltage_v` | Pack 8 Max Cell Voltage | 707 | (R707) × 0.01 | V |  | 30 s | Pack 8 max cell voltage, reg 707, 0.01 V. |
| `battery_pack8_min_cell_voltage_v` | Pack 8 Min Cell Voltage | 708 | (R708) × 0.01 | V |  | 30 s | Pack 8 min cell voltage, reg 708, 0.01 V. |
| `battery_pack9_voltage_v` | Pack 9 Voltage | 712 | (R712) × 0.01 | V |  | 30 s | Pack 9 module voltage, reg 712, 0.01 V. |
| `battery_pack9_current_a` | Pack 9 Current | 713 | (int16(R713)) × 0.1 | A |  | 30 s | Pack 9 module current, reg 713, 0.1 A (signed assumed: charge/discharge direction). |
| `battery_pack9_temperature_c` | Pack 9 Average Temperature | 714 | (R714) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 9 average temperature, reg 714; '1250 = 25.0 C' => (raw-1000)/10. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack9_soc_pct` | Pack 9 State of Charge | 715 | (R715) × 0.1 | % | 0 … 100 | 30 s | Pack 9 SOC, reg 715; PDF unit column says just '0.1' (assumed 0.1 %). Verify on hardware - if it reads 1 % per count, drop the scale. |
| `battery_pack9_charge_voltage_v` | Pack 9 Charge Voltage | 718 | (R718) × 0.01 | V |  | 30 s | Pack 9 charge voltage, reg 718, 0.01 V. |
| `battery_pack9_charge_current_a` | Pack 9 Charge Current | 719 | (R719) × 0.1 | A |  | 30 s | Pack 9 charge current, reg 719, 0.1 A. |
| `battery_pack9_discharge_current_a` | Pack 9 Discharge Current | 720 | (R720) × 0.1 | A |  | 30 s | Pack 9 discharge current, reg 720, 0.1 A. |
| `battery_pack9_max_cell_voltage_v` | Pack 9 Max Cell Voltage | 721 | (R721) × 0.01 | V |  | 30 s | Pack 9 max cell voltage, reg 721, 0.01 V. |
| `battery_pack9_min_cell_voltage_v` | Pack 9 Min Cell Voltage | 722 | (R722) × 0.01 | V |  | 30 s | Pack 9 min cell voltage, reg 722, 0.01 V. |
| `battery_pack10_voltage_v` | Pack 10 Voltage | 726 | (R726) × 0.01 | V |  | 30 s | Pack 10 module voltage, reg 726, 0.01 V. |
| `battery_pack10_current_a` | Pack 10 Current | 727 | (int16(R727)) × 0.1 | A |  | 30 s | Pack 10 module current, reg 727, 0.1 A (signed assumed: charge/discharge direction). |
| `battery_pack10_temperature_c` | Pack 10 Average Temperature | 728 | (R728) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 10 average temperature, reg 728; '1250 = 25.0 C' => (raw-1000)/10. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack10_soc_pct` | Pack 10 State of Charge | 729 | (R729) × 0.1 | % | 0 … 100 | 30 s | Pack 10 SOC, reg 729; PDF unit column says just '0.1' (assumed 0.1 %). Verify on hardware - if it reads 1 % per count, drop the scale. |
| `battery_pack10_charge_voltage_v` | Pack 10 Charge Voltage | 732 | (R732) × 0.01 | V |  | 30 s | Pack 10 charge voltage, reg 732, 0.01 V. |
| `battery_pack10_charge_current_a` | Pack 10 Charge Current | 733 | (R733) × 0.1 | A |  | 30 s | Pack 10 charge current, reg 733, 0.1 A. |
| `battery_pack10_discharge_current_a` | Pack 10 Discharge Current | 734 | (R734) × 0.1 | A |  | 30 s | Pack 10 discharge current, reg 734, 0.1 A. |
| `battery_pack10_max_cell_voltage_v` | Pack 10 Max Cell Voltage | 735 | (R735) × 0.01 | V |  | 30 s | Pack 10 max cell voltage, reg 735, 0.01 V. |
| `battery_pack10_min_cell_voltage_v` | Pack 10 Min Cell Voltage | 736 | (R736) × 0.01 | V |  | 30 s | Pack 10 min cell voltage, reg 736, 0.01 V. |
| `battery_pack11_voltage_v` | Pack 11 Voltage | 740 | (R740) × 0.01 | V |  | 30 s | Pack 11 module voltage, reg 740, 0.01 V. |
| `battery_pack11_current_a` | Pack 11 Current | 741 | (int16(R741)) × 0.1 | A |  | 30 s | Pack 11 module current, reg 741, 0.1 A (signed assumed: charge/discharge direction). |
| `battery_pack11_temperature_c` | Pack 11 Average Temperature | 742 | (R742) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 11 average temperature, reg 742; '1250 = 25.0 C' => (raw-1000)/10. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack11_soc_pct` | Pack 11 State of Charge | 743 | (R743) × 0.1 | % | 0 … 100 | 30 s | Pack 11 SOC, reg 743; PDF unit column says just '0.1' (assumed 0.1 %). Verify on hardware - if it reads 1 % per count, drop the scale. |
| `battery_pack11_charge_voltage_v` | Pack 11 Charge Voltage | 746 | (R746) × 0.01 | V |  | 30 s | Pack 11 charge voltage, reg 746, 0.01 V. |
| `battery_pack11_charge_current_a` | Pack 11 Charge Current | 747 | (R747) × 0.1 | A |  | 30 s | Pack 11 charge current, reg 747, 0.1 A. |
| `battery_pack11_discharge_current_a` | Pack 11 Discharge Current | 748 | (R748) × 0.1 | A |  | 30 s | Pack 11 discharge current, reg 748, 0.1 A. |
| `battery_pack11_max_cell_voltage_v` | Pack 11 Max Cell Voltage | 749 | (R749) × 0.01 | V |  | 30 s | Pack 11 max cell voltage, reg 749, 0.01 V. |
| `battery_pack11_min_cell_voltage_v` | Pack 11 Min Cell Voltage | 750 | (R750) × 0.01 | V |  | 30 s | Pack 11 min cell voltage, reg 750, 0.01 V. |
| `battery_pack12_voltage_v` | Pack 12 Voltage | 754 | (R754) × 0.01 | V |  | 30 s | Pack 12 module voltage, reg 754, 0.01 V. |
| `battery_pack12_current_a` | Pack 12 Current | 755 | (int16(R755)) × 0.1 | A |  | 30 s | Pack 12 module current, reg 755, 0.1 A (signed assumed: charge/discharge direction). |
| `battery_pack12_temperature_c` | Pack 12 Average Temperature | 756 | (R756) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 12 average temperature, reg 756; '1250 = 25.0 C' => (raw-1000)/10. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack12_soc_pct` | Pack 12 State of Charge | 757 | (R757) × 0.1 | % | 0 … 100 | 30 s | Pack 12 SOC, reg 757; PDF unit column says just '0.1' (assumed 0.1 %). Verify on hardware - if it reads 1 % per count, drop the scale. |
| `battery_pack12_charge_voltage_v` | Pack 12 Charge Voltage | 760 | (R760) × 0.01 | V |  | 30 s | Pack 12 charge voltage, reg 760, 0.01 V. |
| `battery_pack12_charge_current_a` | Pack 12 Charge Current | 761 | (R761) × 0.1 | A |  | 30 s | Pack 12 charge current, reg 761, 0.1 A. |
| `battery_pack12_discharge_current_a` | Pack 12 Discharge Current | 762 | (R762) × 0.1 | A |  | 30 s | Pack 12 discharge current, reg 762, 0.1 A. |
| `battery_pack12_max_cell_voltage_v` | Pack 12 Max Cell Voltage | 763 | (R763) × 0.01 | V |  | 30 s | Pack 12 max cell voltage, reg 763, 0.01 V. |
| `battery_pack12_min_cell_voltage_v` | Pack 12 Min Cell Voltage | 764 | (R764) × 0.01 | V |  | 30 s | Pack 12 min cell voltage, reg 764, 0.01 V. |
| `battery_pack13_voltage_v` | Pack 13 Voltage | 768 | (R768) × 0.01 | V |  | 30 s | Pack 13 module voltage, reg 768, 0.01 V. |
| `battery_pack13_current_a` | Pack 13 Current | 769 | (int16(R769)) × 0.1 | A |  | 30 s | Pack 13 module current, reg 769, 0.1 A (signed assumed: charge/discharge direction). |
| `battery_pack13_temperature_c` | Pack 13 Average Temperature | 770 | (R770) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 13 average temperature, reg 770; '1250 = 25.0 C' => (raw-1000)/10. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack13_soc_pct` | Pack 13 State of Charge | 771 | (R771) × 0.1 | % | 0 … 100 | 30 s | Pack 13 SOC, reg 771; PDF unit column says just '0.1' (assumed 0.1 %). Verify on hardware - if it reads 1 % per count, drop the scale. |
| `battery_pack13_charge_voltage_v` | Pack 13 Charge Voltage | 774 | (R774) × 0.01 | V |  | 30 s | Pack 13 charge voltage, reg 774, 0.01 V. |
| `battery_pack13_charge_current_a` | Pack 13 Charge Current | 775 | (R775) × 0.1 | A |  | 30 s | Pack 13 charge current, reg 775, 0.1 A. |
| `battery_pack13_discharge_current_a` | Pack 13 Discharge Current | 776 | (R776) × 0.1 | A |  | 30 s | Pack 13 discharge current, reg 776, 0.1 A. |
| `battery_pack13_max_cell_voltage_v` | Pack 13 Max Cell Voltage | 777 | (R777) × 0.01 | V |  | 30 s | Pack 13 max cell voltage, reg 777, 0.01 V. |
| `battery_pack13_min_cell_voltage_v` | Pack 13 Min Cell Voltage | 778 | (R778) × 0.01 | V |  | 30 s | Pack 13 min cell voltage, reg 778, 0.01 V. |
| `battery_pack14_voltage_v` | Pack 14 Voltage | 782 | (R782) × 0.01 | V |  | 30 s | Pack 14 module voltage, reg 782, 0.01 V. |
| `battery_pack14_current_a` | Pack 14 Current | 783 | (int16(R783)) × 0.1 | A |  | 30 s | Pack 14 module current, reg 783, 0.1 A (signed assumed: charge/discharge direction). |
| `battery_pack14_temperature_c` | Pack 14 Average Temperature | 784 | (R784) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 14 average temperature, reg 784; '1250 = 25.0 C' => (raw-1000)/10. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack14_soc_pct` | Pack 14 State of Charge | 785 | (R785) × 0.1 | % | 0 … 100 | 30 s | Pack 14 SOC, reg 785; PDF unit column says just '0.1' (assumed 0.1 %). Verify on hardware - if it reads 1 % per count, drop the scale. |
| `battery_pack14_charge_voltage_v` | Pack 14 Charge Voltage | 788 | (R788) × 0.01 | V |  | 30 s | Pack 14 charge voltage, reg 788, 0.01 V. |
| `battery_pack14_charge_current_a` | Pack 14 Charge Current | 789 | (R789) × 0.1 | A |  | 30 s | Pack 14 charge current, reg 789, 0.1 A. |
| `battery_pack14_discharge_current_a` | Pack 14 Discharge Current | 790 | (R790) × 0.1 | A |  | 30 s | Pack 14 discharge current, reg 790, 0.1 A. |
| `battery_pack14_max_cell_voltage_v` | Pack 14 Max Cell Voltage | 791 | (R791) × 0.01 | V |  | 30 s | Pack 14 max cell voltage, reg 791, 0.01 V. |
| `battery_pack14_min_cell_voltage_v` | Pack 14 Min Cell Voltage | 792 | (R792) × 0.01 | V |  | 30 s | Pack 14 min cell voltage, reg 792, 0.01 V. |
| `battery_pack15_voltage_v` | Pack 15 Voltage | 796 | (R796) × 0.01 | V |  | 30 s | Pack 15 module voltage, reg 796, 0.01 V. |
| `battery_pack15_current_a` | Pack 15 Current | 797 | (int16(R797)) × 0.1 | A |  | 30 s | Pack 15 module current, reg 797, 0.1 A (signed assumed: charge/discharge direction). |
| `battery_pack15_temperature_c` | Pack 15 Average Temperature | 798 | (R798) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 15 average temperature, reg 798; '1250 = 25.0 C' => (raw-1000)/10. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack15_soc_pct` | Pack 15 State of Charge | 799 | (R799) × 0.1 | % | 0 … 100 | 30 s | Pack 15 SOC, reg 799; PDF unit column says just '0.1' (assumed 0.1 %). Verify on hardware - if it reads 1 % per count, drop the scale. |
| `battery_pack15_charge_voltage_v` | Pack 15 Charge Voltage | 802 | (R802) × 0.01 | V |  | 30 s | Pack 15 charge voltage, reg 802, 0.01 V. |
| `battery_pack15_charge_current_a` | Pack 15 Charge Current | 803 | (R803) × 0.1 | A |  | 30 s | Pack 15 charge current, reg 803, 0.1 A. |
| `battery_pack15_discharge_current_a` | Pack 15 Discharge Current | 804 | (R804) × 0.1 | A |  | 30 s | Pack 15 discharge current, reg 804, 0.1 A. |
| `battery_pack15_max_cell_voltage_v` | Pack 15 Max Cell Voltage | 805 | (R805) × 0.01 | V |  | 30 s | Pack 15 max cell voltage, reg 805, 0.01 V. |
| `battery_pack15_min_cell_voltage_v` | Pack 15 Min Cell Voltage | 806 | (R806) × 0.01 | V |  | 30 s | Pack 15 min cell voltage, reg 806, 0.01 V. |
| `battery_pack_count` | Number of Battery Packs | 10002 | R10002 |  |  | 1 h | Reg 10002 pack count (Deye battery read-only area, 10000+). |
| `battery_pack1_max_cell_temperature_c` | Pack 1 Max Cell Temperature | 10043 | (R10043) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 1 max cell temperature, Deye-battery block reg 10043 (10040+30*(n-1)+3); '1250 = 25.0 C'. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack1_min_cell_temperature_c` | Pack 1 Min Cell Temperature | 10044 | (R10044) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 1 min cell temperature, Deye-battery block reg 10044; '1250 = 25.0 C'. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack2_max_cell_temperature_c` | Pack 2 Max Cell Temperature | 10073 | (R10073) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 2 max cell temperature, Deye-battery block reg 10073 (10040+30*(n-1)+3); '1250 = 25.0 C'. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack2_min_cell_temperature_c` | Pack 2 Min Cell Temperature | 10074 | (R10074) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 2 min cell temperature, Deye-battery block reg 10074; '1250 = 25.0 C'. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack3_max_cell_temperature_c` | Pack 3 Max Cell Temperature | 10103 | (R10103) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 3 max cell temperature, Deye-battery block reg 10103 (10040+30*(n-1)+3); '1250 = 25.0 C'. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack3_min_cell_temperature_c` | Pack 3 Min Cell Temperature | 10104 | (R10104) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 3 min cell temperature, Deye-battery block reg 10104; '1250 = 25.0 C'. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack4_max_cell_temperature_c` | Pack 4 Max Cell Temperature | 10133 | (R10133) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 4 max cell temperature, Deye-battery block reg 10133 (10040+30*(n-1)+3); '1250 = 25.0 C'. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack4_min_cell_temperature_c` | Pack 4 Min Cell Temperature | 10134 | (R10134) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 4 min cell temperature, Deye-battery block reg 10134; '1250 = 25.0 C'. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack5_max_cell_temperature_c` | Pack 5 Max Cell Temperature | 10163 | (R10163) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 5 max cell temperature, Deye-battery block reg 10163 (10040+30*(n-1)+3); '1250 = 25.0 C'. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack5_min_cell_temperature_c` | Pack 5 Min Cell Temperature | 10164 | (R10164) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 5 min cell temperature, Deye-battery block reg 10164; '1250 = 25.0 C'. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack6_max_cell_temperature_c` | Pack 6 Max Cell Temperature | 10193 | (R10193) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 6 max cell temperature, Deye-battery block reg 10193 (10040+30*(n-1)+3); '1250 = 25.0 C'. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack6_min_cell_temperature_c` | Pack 6 Min Cell Temperature | 10194 | (R10194) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 6 min cell temperature, Deye-battery block reg 10194; '1250 = 25.0 C'. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack7_max_cell_temperature_c` | Pack 7 Max Cell Temperature | 10223 | (R10223) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 7 max cell temperature, Deye-battery block reg 10223 (10040+30*(n-1)+3); '1250 = 25.0 C'. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack7_min_cell_temperature_c` | Pack 7 Min Cell Temperature | 10224 | (R10224) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 7 min cell temperature, Deye-battery block reg 10224; '1250 = 25.0 C'. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack8_max_cell_temperature_c` | Pack 8 Max Cell Temperature | 10253 | (R10253) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 8 max cell temperature, Deye-battery block reg 10253 (10040+30*(n-1)+3); '1250 = 25.0 C'. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack8_min_cell_temperature_c` | Pack 8 Min Cell Temperature | 10254 | (R10254) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 8 min cell temperature, Deye-battery block reg 10254; '1250 = 25.0 C'. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack9_max_cell_temperature_c` | Pack 9 Max Cell Temperature | 10283 | (R10283) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 9 max cell temperature, Deye-battery block reg 10283 (10040+30*(n-1)+3); '1250 = 25.0 C'. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack9_min_cell_temperature_c` | Pack 9 Min Cell Temperature | 10284 | (R10284) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 9 min cell temperature, Deye-battery block reg 10284; '1250 = 25.0 C'. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack10_max_cell_temperature_c` | Pack 10 Max Cell Temperature | 10313 | (R10313) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 10 max cell temperature, Deye-battery block reg 10313 (10040+30*(n-1)+3); '1250 = 25.0 C'. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack10_min_cell_temperature_c` | Pack 10 Min Cell Temperature | 10314 | (R10314) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 10 min cell temperature, Deye-battery block reg 10314; '1250 = 25.0 C'. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack11_max_cell_temperature_c` | Pack 11 Max Cell Temperature | 10343 | (R10343) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 11 max cell temperature, Deye-battery block reg 10343 (10040+30*(n-1)+3); '1250 = 25.0 C'. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack11_min_cell_temperature_c` | Pack 11 Min Cell Temperature | 10344 | (R10344) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 11 min cell temperature, Deye-battery block reg 10344; '1250 = 25.0 C'. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack12_max_cell_temperature_c` | Pack 12 Max Cell Temperature | 10373 | (R10373) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 12 max cell temperature, Deye-battery block reg 10373 (10040+30*(n-1)+3); '1250 = 25.0 C'. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack12_min_cell_temperature_c` | Pack 12 Min Cell Temperature | 10374 | (R10374) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 12 min cell temperature, Deye-battery block reg 10374; '1250 = 25.0 C'. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack13_max_cell_temperature_c` | Pack 13 Max Cell Temperature | 10403 | (R10403) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 13 max cell temperature, Deye-battery block reg 10403 (10040+30*(n-1)+3); '1250 = 25.0 C'. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack13_min_cell_temperature_c` | Pack 13 Min Cell Temperature | 10404 | (R10404) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 13 min cell temperature, Deye-battery block reg 10404; '1250 = 25.0 C'. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack14_max_cell_temperature_c` | Pack 14 Max Cell Temperature | 10433 | (R10433) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 14 max cell temperature, Deye-battery block reg 10433 (10040+30*(n-1)+3); '1250 = 25.0 C'. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack14_min_cell_temperature_c` | Pack 14 Min Cell Temperature | 10434 | (R10434) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 14 min cell temperature, Deye-battery block reg 10434; '1250 = 25.0 C'. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack15_max_cell_temperature_c` | Pack 15 Max Cell Temperature | 10463 | (R10463) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 15 max cell temperature, Deye-battery block reg 10463 (10040+30*(n-1)+3); '1250 = 25.0 C'. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `battery_pack15_min_cell_temperature_c` | Pack 15 Min Cell Temperature | 10464 | (R10464) × 0.1 − 100 | °C | -100 … 200 | 30 s | Pack 15 min cell temperature, Deye-battery block reg 10464; '1250 = 25.0 C'. [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `backup_time_remaining_h` | Backup Time Remaining |  | Derived by the platform (see Notes) | h |  | 30 s | Derived: (SOC - low-battery SOC) / 100 x capacity_ah x battery_voltage_v / load_total_power_w. No register. |
| `battery_state` | Battery State |  | Derived by the platform (see Notes) |  |  | 30 s | Derived from battery_power_w sign and SOC (charging / discharging / idle). No register. |

### Battery Alerts (36)

| Key | Name | Reg | Formula | Unit | Valid range | Every | Notes |
|---|---|---|---|---|---|---|---|
| `battery_alarm` | Battery Alarm | 322 | R322 |  |  | 10 s | Reg 322 lithium battery alarm word (raw bitmask). |
| `battery_fault` | Battery Fault | 323 | R323 |  |  | 10 s | Reg 323 lithium battery fault word (raw bitmask). |
| `battery_pack1_warning` | Pack 1 Warning | 612 | R612 |  |  | 10 s | Pack 1 warning word, reg 612 (raw bitmask). |
| `battery_pack1_fault` | Pack 1 Fault | 613 | R613 |  |  | 10 s | Pack 1 fault word, reg 613 (raw bitmask). |
| `battery_pack2_warning` | Pack 2 Warning | 626 | R626 |  |  | 10 s | Pack 2 warning word, reg 626 (raw bitmask). |
| `battery_pack2_fault` | Pack 2 Fault | 627 | R627 |  |  | 10 s | Pack 2 fault word, reg 627 (raw bitmask). |
| `battery_pack3_warning` | Pack 3 Warning | 640 | R640 |  |  | 10 s | Pack 3 warning word, reg 640 (raw bitmask). |
| `battery_pack3_fault` | Pack 3 Fault | 641 | R641 |  |  | 10 s | Pack 3 fault word, reg 641 (raw bitmask). |
| `battery_pack4_warning` | Pack 4 Warning | 654 | R654 |  |  | 10 s | Pack 4 warning word, reg 654 (raw bitmask). |
| `battery_pack4_fault` | Pack 4 Fault | 655 | R655 |  |  | 10 s | Pack 4 fault word, reg 655 (raw bitmask). |
| `battery_pack5_warning` | Pack 5 Warning | 668 | R668 |  |  | 10 s | Pack 5 warning word, reg 668 (raw bitmask). |
| `battery_pack5_fault` | Pack 5 Fault | 669 | R669 |  |  | 10 s | Pack 5 fault word, reg 669 (raw bitmask). |
| `battery_pack6_warning` | Pack 6 Warning | 682 | R682 |  |  | 10 s | Pack 6 warning word, reg 682 (raw bitmask). |
| `battery_pack6_fault` | Pack 6 Fault | 683 | R683 |  |  | 10 s | Pack 6 fault word, reg 683 (raw bitmask). |
| `battery_pack7_warning` | Pack 7 Warning | 696 | R696 |  |  | 10 s | Pack 7 warning word, reg 696 (raw bitmask). |
| `battery_pack7_fault` | Pack 7 Fault | 697 | R697 |  |  | 10 s | Pack 7 fault word, reg 697 (raw bitmask). |
| `battery_pack8_warning` | Pack 8 Warning | 710 | R710 |  |  | 10 s | Pack 8 warning word, reg 710 (raw bitmask). |
| `battery_pack8_fault` | Pack 8 Fault | 711 | R711 |  |  | 10 s | Pack 8 fault word, reg 711 (raw bitmask). |
| `battery_pack9_warning` | Pack 9 Warning | 724 | R724 |  |  | 10 s | Pack 9 warning word, reg 724 (raw bitmask). |
| `battery_pack9_fault` | Pack 9 Fault | 725 | R725 |  |  | 10 s | Pack 9 fault word, reg 725 (raw bitmask). |
| `battery_pack10_warning` | Pack 10 Warning | 738 | R738 |  |  | 10 s | Pack 10 warning word, reg 738 (raw bitmask). |
| `battery_pack10_fault` | Pack 10 Fault | 739 | R739 |  |  | 10 s | Pack 10 fault word, reg 739 (raw bitmask). |
| `battery_pack11_warning` | Pack 11 Warning | 752 | R752 |  |  | 10 s | Pack 11 warning word, reg 752 (raw bitmask). |
| `battery_pack11_fault` | Pack 11 Fault | 753 | R753 |  |  | 10 s | Pack 11 fault word, reg 753 (raw bitmask). |
| `battery_pack12_warning` | Pack 12 Warning | 766 | R766 |  |  | 10 s | Pack 12 warning word, reg 766 (raw bitmask). |
| `battery_pack12_fault` | Pack 12 Fault | 767 | R767 |  |  | 10 s | Pack 12 fault word, reg 767 (raw bitmask). |
| `battery_pack13_warning` | Pack 13 Warning | 780 | R780 |  |  | 10 s | Pack 13 warning word, reg 780 (raw bitmask). |
| `battery_pack13_fault` | Pack 13 Fault | 781 | R781 |  |  | 10 s | Pack 13 fault word, reg 781 (raw bitmask). |
| `battery_pack14_warning` | Pack 14 Warning | 794 | R794 |  |  | 10 s | Pack 14 warning word, reg 794 (raw bitmask). |
| `battery_pack14_fault` | Pack 14 Fault | 795 | R795 |  |  | 10 s | Pack 14 fault word, reg 795 (raw bitmask). |
| `battery_pack15_warning` | Pack 15 Warning | 808 | R808 |  |  | 10 s | Pack 15 warning word, reg 808 (raw bitmask). |
| `battery_pack15_fault` | Pack 15 Fault | 809 | R809 |  |  | 10 s | Pack 15 fault word, reg 809 (raw bitmask). |
| `bms_fault_1` | BMS Fault 1 | 10019 | R10019 |  |  | 10 s | Reg 10019 Deye battery fault 1. |
| `bms_fault_2` | BMS Fault 2 | 10020 | R10020 |  |  | 10 s | Reg 10020 Deye battery fault 2. |
| `bms_alarm_1` | BMS Alarm 1 | 10021 | R10021 |  |  | 10 s | Reg 10021 Deye battery alarm 1. |
| `bms_alarm_2` | BMS Alarm 2 | 10022 | R10022 |  |  | 10 s | Reg 10022 Deye battery alarm 2. |

### Battery Health (64)

| Key | Name | Reg | Formula | Unit | Valid range | Every | Notes |
|---|---|---|---|---|---|---|---|
| `battery_corrected_capacity_ah` | Corrected Capacity | 107 | R107 | Ah |  | 30 s | Reg 107 battery corrected capacity, 1 Ah. |
| `battery_pack1_remaining_capacity_ah` | Pack 1 Remaining Capacity | 604 | (R604) × 0.1 | Ah |  | 30 s | Pack 1 remaining capacity, reg 604, 0.1 Ah. |
| `battery_pack1_total_capacity_ah` | Pack 1 Total Capacity | 605 | (R605) × 0.1 | Ah |  | 30 s | Pack 1 total capacity, reg 605, 0.1 Ah. |
| `battery_pack1_cycle_count` | Pack 1 Charge Cycles | 611 | R611 | cycles |  | 30 s | Pack 1 cycle number, reg 611. |
| `battery_pack2_remaining_capacity_ah` | Pack 2 Remaining Capacity | 618 | (R618) × 0.1 | Ah |  | 30 s | Pack 2 remaining capacity, reg 618, 0.1 Ah. |
| `battery_pack2_total_capacity_ah` | Pack 2 Total Capacity | 619 | (R619) × 0.1 | Ah |  | 30 s | Pack 2 total capacity, reg 619, 0.1 Ah. |
| `battery_pack2_cycle_count` | Pack 2 Charge Cycles | 625 | R625 | cycles |  | 30 s | Pack 2 cycle number, reg 625. |
| `battery_pack3_remaining_capacity_ah` | Pack 3 Remaining Capacity | 632 | (R632) × 0.1 | Ah |  | 30 s | Pack 3 remaining capacity, reg 632, 0.1 Ah. |
| `battery_pack3_total_capacity_ah` | Pack 3 Total Capacity | 633 | (R633) × 0.1 | Ah |  | 30 s | Pack 3 total capacity, reg 633, 0.1 Ah. |
| `battery_pack3_cycle_count` | Pack 3 Charge Cycles | 639 | R639 | cycles |  | 30 s | Pack 3 cycle number, reg 639. |
| `battery_pack4_remaining_capacity_ah` | Pack 4 Remaining Capacity | 646 | (R646) × 0.1 | Ah |  | 30 s | Pack 4 remaining capacity, reg 646, 0.1 Ah. |
| `battery_pack4_total_capacity_ah` | Pack 4 Total Capacity | 647 | (R647) × 0.1 | Ah |  | 30 s | Pack 4 total capacity, reg 647, 0.1 Ah. |
| `battery_pack4_cycle_count` | Pack 4 Charge Cycles | 653 | R653 | cycles |  | 30 s | Pack 4 cycle number, reg 653. |
| `battery_pack5_remaining_capacity_ah` | Pack 5 Remaining Capacity | 660 | (R660) × 0.1 | Ah |  | 30 s | Pack 5 remaining capacity, reg 660, 0.1 Ah. |
| `battery_pack5_total_capacity_ah` | Pack 5 Total Capacity | 661 | (R661) × 0.1 | Ah |  | 30 s | Pack 5 total capacity, reg 661, 0.1 Ah. |
| `battery_pack5_cycle_count` | Pack 5 Charge Cycles | 667 | R667 | cycles |  | 30 s | Pack 5 cycle number, reg 667. |
| `battery_pack6_remaining_capacity_ah` | Pack 6 Remaining Capacity | 674 | (R674) × 0.1 | Ah |  | 30 s | Pack 6 remaining capacity, reg 674, 0.1 Ah. |
| `battery_pack6_total_capacity_ah` | Pack 6 Total Capacity | 675 | (R675) × 0.1 | Ah |  | 30 s | Pack 6 total capacity, reg 675, 0.1 Ah. |
| `battery_pack6_cycle_count` | Pack 6 Charge Cycles | 681 | R681 | cycles |  | 30 s | Pack 6 cycle number, reg 681. |
| `battery_pack7_remaining_capacity_ah` | Pack 7 Remaining Capacity | 688 | (R688) × 0.1 | Ah |  | 30 s | Pack 7 remaining capacity, reg 688, 0.1 Ah. |
| `battery_pack7_total_capacity_ah` | Pack 7 Total Capacity | 689 | (R689) × 0.1 | Ah |  | 30 s | Pack 7 total capacity, reg 689, 0.1 Ah. |
| `battery_pack7_cycle_count` | Pack 7 Charge Cycles | 695 | R695 | cycles |  | 30 s | Pack 7 cycle number, reg 695. |
| `battery_pack8_remaining_capacity_ah` | Pack 8 Remaining Capacity | 702 | (R702) × 0.1 | Ah |  | 30 s | Pack 8 remaining capacity, reg 702, 0.1 Ah. |
| `battery_pack8_total_capacity_ah` | Pack 8 Total Capacity | 703 | (R703) × 0.1 | Ah |  | 30 s | Pack 8 total capacity, reg 703, 0.1 Ah. |
| `battery_pack8_cycle_count` | Pack 8 Charge Cycles | 709 | R709 | cycles |  | 30 s | Pack 8 cycle number, reg 709. |
| `battery_pack9_remaining_capacity_ah` | Pack 9 Remaining Capacity | 716 | (R716) × 0.1 | Ah |  | 30 s | Pack 9 remaining capacity, reg 716, 0.1 Ah. |
| `battery_pack9_total_capacity_ah` | Pack 9 Total Capacity | 717 | (R717) × 0.1 | Ah |  | 30 s | Pack 9 total capacity, reg 717, 0.1 Ah. |
| `battery_pack9_cycle_count` | Pack 9 Charge Cycles | 723 | R723 | cycles |  | 30 s | Pack 9 cycle number, reg 723. |
| `battery_pack10_remaining_capacity_ah` | Pack 10 Remaining Capacity | 730 | (R730) × 0.1 | Ah |  | 30 s | Pack 10 remaining capacity, reg 730, 0.1 Ah. |
| `battery_pack10_total_capacity_ah` | Pack 10 Total Capacity | 731 | (R731) × 0.1 | Ah |  | 30 s | Pack 10 total capacity, reg 731, 0.1 Ah. |
| `battery_pack10_cycle_count` | Pack 10 Charge Cycles | 737 | R737 | cycles |  | 30 s | Pack 10 cycle number, reg 737. |
| `battery_pack11_remaining_capacity_ah` | Pack 11 Remaining Capacity | 744 | (R744) × 0.1 | Ah |  | 30 s | Pack 11 remaining capacity, reg 744, 0.1 Ah. |
| `battery_pack11_total_capacity_ah` | Pack 11 Total Capacity | 745 | (R745) × 0.1 | Ah |  | 30 s | Pack 11 total capacity, reg 745, 0.1 Ah. |
| `battery_pack11_cycle_count` | Pack 11 Charge Cycles | 751 | R751 | cycles |  | 30 s | Pack 11 cycle number, reg 751. |
| `battery_pack12_remaining_capacity_ah` | Pack 12 Remaining Capacity | 758 | (R758) × 0.1 | Ah |  | 30 s | Pack 12 remaining capacity, reg 758, 0.1 Ah. |
| `battery_pack12_total_capacity_ah` | Pack 12 Total Capacity | 759 | (R759) × 0.1 | Ah |  | 30 s | Pack 12 total capacity, reg 759, 0.1 Ah. |
| `battery_pack12_cycle_count` | Pack 12 Charge Cycles | 765 | R765 | cycles |  | 30 s | Pack 12 cycle number, reg 765. |
| `battery_pack13_remaining_capacity_ah` | Pack 13 Remaining Capacity | 772 | (R772) × 0.1 | Ah |  | 30 s | Pack 13 remaining capacity, reg 772, 0.1 Ah. |
| `battery_pack13_total_capacity_ah` | Pack 13 Total Capacity | 773 | (R773) × 0.1 | Ah |  | 30 s | Pack 13 total capacity, reg 773, 0.1 Ah. |
| `battery_pack13_cycle_count` | Pack 13 Charge Cycles | 779 | R779 | cycles |  | 30 s | Pack 13 cycle number, reg 779. |
| `battery_pack14_remaining_capacity_ah` | Pack 14 Remaining Capacity | 786 | (R786) × 0.1 | Ah |  | 30 s | Pack 14 remaining capacity, reg 786, 0.1 Ah. |
| `battery_pack14_total_capacity_ah` | Pack 14 Total Capacity | 787 | (R787) × 0.1 | Ah |  | 30 s | Pack 14 total capacity, reg 787, 0.1 Ah. |
| `battery_pack14_cycle_count` | Pack 14 Charge Cycles | 793 | R793 | cycles |  | 30 s | Pack 14 cycle number, reg 793. |
| `battery_pack15_remaining_capacity_ah` | Pack 15 Remaining Capacity | 800 | (R800) × 0.1 | Ah |  | 30 s | Pack 15 remaining capacity, reg 800, 0.1 Ah. |
| `battery_pack15_total_capacity_ah` | Pack 15 Total Capacity | 801 | (R801) × 0.1 | Ah |  | 30 s | Pack 15 total capacity, reg 801, 0.1 Ah. |
| `battery_pack15_cycle_count` | Pack 15 Charge Cycles | 807 | R807 | cycles |  | 30 s | Pack 15 cycle number, reg 807. |
| `battery_soh_pct` | Battery Health (SOH) | 10006 | R10006 | % | 0 … 100 | 30 s | Reg 10006 Deye battery SOH, 1 %. |
| `battery_remaining_capacity_ah` | Remaining Capacity | 10007 | R10007 | Ah |  | 30 s | Reg 10007 Deye battery remaining capacity, 1 Ah. |
| `battery_pack1_soh_pct` | Pack 1 Health (SOH) | 10048 | (R10048) × 0.1 | % | 0 … 100 | 30 s | Pack 1 SOH, Deye-battery block reg 10048; PDF unit '0.1' (assumed 0.1 %). Verify on hardware. |
| `battery_pack2_soh_pct` | Pack 2 Health (SOH) | 10078 | (R10078) × 0.1 | % | 0 … 100 | 30 s | Pack 2 SOH, Deye-battery block reg 10078; PDF unit '0.1' (assumed 0.1 %). Verify on hardware. |
| `battery_pack3_soh_pct` | Pack 3 Health (SOH) | 10108 | (R10108) × 0.1 | % | 0 … 100 | 30 s | Pack 3 SOH, Deye-battery block reg 10108; PDF unit '0.1' (assumed 0.1 %). Verify on hardware. |
| `battery_pack4_soh_pct` | Pack 4 Health (SOH) | 10138 | (R10138) × 0.1 | % | 0 … 100 | 30 s | Pack 4 SOH, Deye-battery block reg 10138; PDF unit '0.1' (assumed 0.1 %). Verify on hardware. |
| `battery_pack5_soh_pct` | Pack 5 Health (SOH) | 10168 | (R10168) × 0.1 | % | 0 … 100 | 30 s | Pack 5 SOH, Deye-battery block reg 10168; PDF unit '0.1' (assumed 0.1 %). Verify on hardware. |
| `battery_pack6_soh_pct` | Pack 6 Health (SOH) | 10198 | (R10198) × 0.1 | % | 0 … 100 | 30 s | Pack 6 SOH, Deye-battery block reg 10198; PDF unit '0.1' (assumed 0.1 %). Verify on hardware. |
| `battery_pack7_soh_pct` | Pack 7 Health (SOH) | 10228 | (R10228) × 0.1 | % | 0 … 100 | 30 s | Pack 7 SOH, Deye-battery block reg 10228; PDF unit '0.1' (assumed 0.1 %). Verify on hardware. |
| `battery_pack8_soh_pct` | Pack 8 Health (SOH) | 10258 | (R10258) × 0.1 | % | 0 … 100 | 30 s | Pack 8 SOH, Deye-battery block reg 10258; PDF unit '0.1' (assumed 0.1 %). Verify on hardware. |
| `battery_pack9_soh_pct` | Pack 9 Health (SOH) | 10288 | (R10288) × 0.1 | % | 0 … 100 | 30 s | Pack 9 SOH, Deye-battery block reg 10288; PDF unit '0.1' (assumed 0.1 %). Verify on hardware. |
| `battery_pack10_soh_pct` | Pack 10 Health (SOH) | 10318 | (R10318) × 0.1 | % | 0 … 100 | 30 s | Pack 10 SOH, Deye-battery block reg 10318; PDF unit '0.1' (assumed 0.1 %). Verify on hardware. |
| `battery_pack11_soh_pct` | Pack 11 Health (SOH) | 10348 | (R10348) × 0.1 | % | 0 … 100 | 30 s | Pack 11 SOH, Deye-battery block reg 10348; PDF unit '0.1' (assumed 0.1 %). Verify on hardware. |
| `battery_pack12_soh_pct` | Pack 12 Health (SOH) | 10378 | (R10378) × 0.1 | % | 0 … 100 | 30 s | Pack 12 SOH, Deye-battery block reg 10378; PDF unit '0.1' (assumed 0.1 %). Verify on hardware. |
| `battery_pack13_soh_pct` | Pack 13 Health (SOH) | 10408 | (R10408) × 0.1 | % | 0 … 100 | 30 s | Pack 13 SOH, Deye-battery block reg 10408; PDF unit '0.1' (assumed 0.1 %). Verify on hardware. |
| `battery_pack14_soh_pct` | Pack 14 Health (SOH) | 10438 | (R10438) × 0.1 | % | 0 … 100 | 30 s | Pack 14 SOH, Deye-battery block reg 10438; PDF unit '0.1' (assumed 0.1 %). Verify on hardware. |
| `battery_pack15_soh_pct` | Pack 15 Health (SOH) | 10468 | (R10468) × 0.1 | % | 0 … 100 | 30 s | Pack 15 SOH, Deye-battery block reg 10468; PDF unit '0.1' (assumed 0.1 %). Verify on hardware. |
| `battery_round_trip_efficiency_pct` | Round-trip Efficiency |  | Derived by the platform (see Notes) | % |  | 30 s | Derived: total_battery_discharge_energy_kwh / total_battery_charge_energy_kwh. No register. |

### Device Info (12)

| Key | Name | Reg | Formula | Unit | Valid range | Every | Notes |
|---|---|---|---|---|---|---|---|
| `device_type` | Inverter Type | 0 | R0 |  |  | 1 h | Reg 0 device type: 0x0300 = single-phase low-voltage storage inverter (PDF). No enum attached: the stored 'device_type' enum only carries 0x0200. |
| `protocol_version` | Protocol Version | 2 | R2 |  |  | 1 h | Reg 2 communication protocol version (0x0102 = v1.2). |
| `serial_number` | Serial Number | 3, 4, 5, 6, 7 | Special packing (see Notes) |  |  | 1 h | Regs 3-7 serial number, 10 ASCII bytes (e.g. 'AH12345678'). |
| `control_board_firmware_version` | Control Board Firmware | 13 | R13 |  |  | 1 h | Reg 13 control-board firmware version. |
| `communication_board_firmware_version` | Communication Board Firmware | 14 | R14 |  |  | 1 h | Reg 14 communication-board firmware version. |
| `rated_power_w` | Rated Power (W) | 16, 17 | (R16 + R17 × 65536) × 0.1 |  |  | 1 h | Regs 16 (low) / 17 (high) rated power, 0.1 W unit. |
| `mppt_count` | Number of PV Inputs | 18 | (R18 & 0xFF00) >> 8 |  |  | 1 h | Reg 18 'MPPT number and phase': high byte = MPPT count, low byte = phases (0x0503 = five MPPT, three phase). Take (raw & 0xFF00) >> 8. |
| `phase_count` | Number of Phases | 18 | R18 & 0x00FF |  |  | 1 h | Reg 18 low byte = number of phases (raw & 0x00FF). |
| `phase_count` | Supply Phases | 18 | R18 & 0x00FF |  |  | 1 h | Reg 18 low byte = number of phases (raw & 0x00FF). |
| `battery_firmware_version` | Battery Firmware | 419, 420 | R419 + R420 × 65536 |  |  | 1 h | Regs 419 (low) / 420 (high) lithium version number; for parallel batteries only the last unit is readable. |
| `battery_model` | Battery Model |  | Derived by the platform (see Notes) |  |  | 24 h | Site record (stock/installation data), not read from the inverter. |
| `installed_pv_kwp` | Solar Capacity (kWp) |  | Derived by the platform (see Notes) |  |  | 24 h | Site record, not read from the inverter. |

### Energy (12)

| Key | Name | Reg | Formula | Unit | Valid range | Every | Notes |
|---|---|---|---|---|---|---|---|
| `month_pv_energy_kwh` | Production This Month | 65 | R65 | kWh |  | 30 s | Reg 65 month PV energy, 1 kWh. PDF also lists 'battery 1 current' (0.01 A) for this slot on some hybrid builds - confirm on hardware. [2026-10-05: hidden - this register reads 0 on the real SUN-8K (live check; e.g. year PV = 0 while lifetime PV = 25 kWh), so the firmware does not populate it. Re-enable if a different source is mapped; month/year totals can instead be computed from the daily rollups.] |
| `month_load_energy_kwh` | Consumption This Month | 66 | R66 | kWh |  | 30 s | Reg 66 month load energy, 1 kWh. PDF also lists 'battery 2 current' (0.01 A) for this slot on some hybrid builds - confirm on hardware. [2026-10-05: hidden - this register reads 0 on the real SUN-8K (live check; e.g. year PV = 0 while lifetime PV = 25 kWh), so the firmware does not populate it. Re-enable if a different source is mapped; month/year totals can instead be computed from the daily rollups.] |
| `month_grid_export_energy_kwh` | Exported This Month | 67 | R67 | kWh |  | 30 s | Reg 67 month grid-sell energy, 1 kWh. PDF hybrid column shares this slot with other model variants - confirm on hardware. [2026-10-05: hidden - this register reads 0 on the real SUN-8K (live check; e.g. year PV = 0 while lifetime PV = 25 kWh), so the firmware does not populate it. Re-enable if a different source is mapped; month/year totals can instead be computed from the daily rollups.] |
| `year_pv_energy_kwh` | Production This Year | 68, 69 | (R68 + R69 × 65536) × 0.1 | kWh |  | 30 s | Regs 68 (low) / 69 (high) year PV energy, 0.1 kWh. [2026-10-05: hidden - this register reads 0 on the real SUN-8K (live check; e.g. year PV = 0 while lifetime PV = 25 kWh), so the firmware does not populate it. Re-enable if a different source is mapped; month/year totals can instead be computed from the daily rollups.] |
| `total_battery_charge_energy_kwh` | Battery Charged Total | 72, 73 | (R72 + R73 × 65536) × 0.1 | kWh |  | 30 s | Regs 72 (low) / 73 (high) total battery charge energy, 0.1 kWh. |
| `total_battery_discharge_energy_kwh` | Battery Discharged Total | 74, 75 | (R74 + R75 × 65536) × 0.1 | kWh |  | 30 s | Regs 74 (low) / 75 (high) total battery discharge energy, 0.1 kWh. |
| `total_grid_import_energy_kwh` | Imported Total | 78, 80 | (R78 + R80 × 65536) × 0.1 | kWh |  | 30 s | Regs 78 (low) / 80 (high) total grid-buy energy, 0.1 kWh (non-contiguous). |
| `total_grid_export_energy_kwh` | Exported Total | 81, 82 | (R81 + R82 × 65536) × 0.1 | kWh |  | 30 s | Regs 81 (low) / 82 (high) total grid-sell energy, 0.1 kWh. |
| `total_load_energy_kwh` | Consumption Total | 85, 86 | (R85 + R86 × 65536) × 0.1 | kWh |  | 30 s | Regs 85 (low) / 86 (high) total load energy, 0.1 kWh. |
| `year_load_energy_kwh` | Consumption This Year | 87, 88 | (R87 + R88 × 65536) × 0.1 | kWh |  | 30 s | Regs 87 (low) / 88 (high) year load energy, 0.1 kWh. [2026-10-05: hidden - this register reads 0 on the real SUN-8K (live check; e.g. year PV = 0 while lifetime PV = 25 kWh), so the firmware does not populate it. Re-enable if a different source is mapped; month/year totals can instead be computed from the daily rollups.] |
| `total_generator_energy_kwh` | Generator Energy Total | 92, 95 | (R92 + R95 × 65536) × 0.1 | kWh |  | 30 s | Regs 92 (low) / 95 (high) total generator energy, 0.1 kWh (non-contiguous). |
| `year_grid_export_energy_kwh` | Exported This Year | 98, 99 | (R98 + R99 × 65536) × 0.1 | kWh |  | 30 s | Regs 98 (low) / 99 (high) year grid-sell energy, 0.1 kWh. [2026-10-05: hidden - this register reads 0 on the real SUN-8K (live check; e.g. year PV = 0 while lifetime PV = 25 kWh), so the firmware does not populate it. Re-enable if a different source is mapped; month/year totals can instead be computed from the daily rollups.] |

### Generator (6)

| Key | Name | Reg | Formula | Unit | Valid range | Every | Notes |
|---|---|---|---|---|---|---|---|
| `day_generator_energy_kwh` | Generator Energy Today | 62 | (R62) × 0.1 | kWh |  | 30 s | Reg 62 today generator energy, 0.1 kWh. |
| `generator_day_run_time_h` | Run Time Today | 83 | (R83) × 0.1 | h |  | 30 s | Reg 83 generator daily operating time, 0.1 h (240 = 24 h). |
| `generator_power_w` | Generator Power | 166 | int16(R166) | W |  | 5 s | Reg 166 generator / micro-inverse power, 1 W signed (negative when the micro-inverter feeds the inverter). |
| `generator_voltage_v` | Generator Voltage | 181 | (R181) × 0.1 | V |  | 5 s | Reg 181 generator port voltage, 0.1 V (added in V116). |
| `generator_relay_status` | Generator Status | 195 | R195 & 0x000F |  |  | 5 s | Reg 195 low nibble (bits 0-3): 0 open, 1 closed, 3 closed while generator running. Bits 4-7 = switch signal (0 off, 1 on). |
| `generator_frequency_hz` | Generator Frequency | 196 | (R196) × 0.01 | Hz |  | 5 s | Reg 196 generator port frequency, 0.01 Hz. |

### Grid (9)

| Key | Name | Reg | Formula | Unit | Valid range | Every | Notes |
|---|---|---|---|---|---|---|---|
| `grid_frequency_hz` | Frequency | 79 | (R79) × 0.01 | Hz |  | 5 s | Reg 79 grid frequency, 0.01 Hz. |
| `grid_l1_voltage_v` | Voltage L1 | 150 | (R150) × 0.1 | V |  | 5 s | Reg 150 grid-side voltage L1-N, 0.1 V. |
| `grid_relay_middle_voltage_v` | Relay Middle-side Voltage | 153 | (R153) × 0.1 | V |  | 5 s | Reg 153 voltage at the middle side of the relay L1-L2, 0.1 V. |
| `grid_l1_current_a` | Current L1 | 160 | (int16(R160)) × 0.01 | A |  | 5 s | Reg 160 grid-side current L1, signed, 0.01 A. |
| `grid_ct_l1_current_a` | CT Current L1 | 162 | (int16(R162)) × 0.01 | A |  | 5 s | Reg 162 external limiter (CT) current L1, signed, 0.01 A. |
| `grid_l1_power_w` | Power L1 | 167 | int16(R167) | W |  | 5 s | Reg 167 grid-side L1 power, signed, 1 W (positive = buying, negative = selling). If reg 54 (AC power ratio) = 0 the unit is 10 W - multiply by 10. |
| `grid_ct_l1_power_w` | CT Power L1 | 170 | int16(R170) | W |  | 5 s | Reg 170 external limiter 1 power, signed, 1 W. Unit is 10 W when reg 54 = 0 (see grid_l1_power_w). |
| `grid_ct_total_power_w` | CT Total Power | 172 | int16(R172) | W |  | 5 s | Reg 172 external limiter total power, signed, 1 W. Unit is 10 W when reg 54 = 0. |
| `grid_relay_status` | Grid Connection | 194 | R194 |  |  | 5 s | Reg 194 grid-side relay status: 0 open (disconnected), 1 closed. |

### Home Load (4)

| Key | Name | Reg | Formula | Unit | Valid range | Every | Notes |
|---|---|---|---|---|---|---|---|
| `load_l1_voltage_v` | Voltage L1 | 157 | (R157) × 0.1 | V |  | 5 s | Reg 157 load voltage L1, 0.1 V. |
| `load_l1_power_w` | Power L1 | 176 | int16(R176) | W |  | 5 s | Reg 176 load-side L1 power, signed, 1 W. Unit is 10 W when reg 54 = 0. |
| `load_l1_current_a` | Current L1 | 179 | (int16(R179)) × 0.01 | A |  | 5 s | Reg 179 load current L1, signed, 0.01 A. |
| `load_frequency_hz` | Frequency | 192 | (R192) × 0.01 | Hz |  | 5 s | Reg 192 load frequency, 0.01 Hz. |

### Installer Settings (view only) (12)

| Key | Name | Reg | Formula | Unit | Valid range | Every | Notes |
|---|---|---|---|---|---|---|---|
| `grid_standard` | Grid Standard | 51 | R51, then look up in enum grid_standard |  |  | 5 min | Reg 51 grid standard code (1 INMETRO, 2 EN50549, 3 EN50438 ... 11 AS4777 ...). |
| `battery_type` | Battery Type | 200 | R200, then look up in enum battery_type |  |  | 5 min | Reg 200 battery charge type: 0 lead-acid (four-stage), 1 lithium. |
| `battery_capacity_ah` | Battery Capacity | 204 | R204 | Ah | 0 … 2000 | 5 min | Reg 204 battery capacity, 1 Ah (200 = 200 Ah). Range 0-2000. |
| `battery_max_charge_current_a` | Max Charge Current | 210 | R210 | A | 0 … 185 | 5 min | Reg 210 max battery charge current, 1 A, 0-185. |
| `battery_max_discharge_current_a` | Max Discharge Current | 211 | R211 | A | 0 … 185 | 5 min | Reg 211 max battery discharge current, 1 A, 0-185. |
| `battery_management_mode` | Battery Managed By | 213 | R213, then look up in enum batt_control_mode |  |  | 5 min | Reg 213: 0 by voltage, 1 by capacity, 2 no battery. |
| `battery_shutdown_soc_pct` | Battery Shutdown Level | 217 | R217 | % | 0 … 100 | 5 min | Reg 217 battery capacity shutdown (low-capacity cutoff), 1 %. |
| `battery_restart_soc_pct` | Battery Restart Level | 218 | R218 | % | 0 … 100 | 5 min | Reg 218 battery capacity restart (protection recovery point), 1 %. |
| `generator_port_function` | Generator Port Use | 235 | R235, then look up in enum gen_port_function |  |  | 5 min | Reg 235: 0 generator input only, 1 smart-load output, 2 micro-inverter input. |
| `max_export_power_w` | Maximum Export Power | 245 | R245 | W | 0 … 8000 | 5 min | Reg 245 export power limiter (total), 1 W, 0-8000. |
| `grid_frequency_setting` | Grid Frequency | 285 | R285, then look up in enum grid_frequency_setting |  |  | 5 min | Reg 285: 0 = 50 Hz, 1 = 60 Hz. |
| `grid_type` | Grid Type | 286 | R286, then look up in enum grid_type |  |  | 5 min | Reg 286: 0 single-phase, 1 split-phase 120/240 V, 2 three-phase 208/120 V, 3 120 V single-phase. |

### Inverter (12)

| Key | Name | Reg | Formula | Unit | Valid range | Every | Notes |
|---|---|---|---|---|---|---|---|
| `day_active_energy_kwh` | AC Output Today | 60 | (int16(R60)) × 0.1 | kWh |  | 30 s | Reg 60 day active energy, signed int16, 0.1 kWh. |
| `day_reactive_energy_kvarh` | Reactive Energy Today | 61 | (int16(R61)) × 0.1 | kvarh |  | 30 s | Reg 61 day reactive energy, signed int16, 0.1 kvarh. |
| `total_active_energy_kwh` | AC Output Total | 63, 64 | (R63 + R64 × 65536) × 0.1 | kWh |  | 30 s | Regs 63 (low) / 64 (high) total active energy, 0.1 kWh. |
| `inverter_dc_temperature_c` | Heat-sink Temperature (DC) | 90 | (R90) × 0.1 − 100 | °C | -100 … 200 | 30 s | Reg 90 radiator (DC transformer) temperature, 0.1 C offset +1000 (1000 = 0 C). [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `inverter_ac_temperature_c` | Heat-sink Temperature (AC) | 91 | (R91) × 0.1 − 100 | °C | -100 … 200 | 30 s | Reg 91 IGBT / AC radiator temperature, 0.1 C offset +1000 (1505 = 50.5 C). [2026-10-05: decode corrected to raw x 0.1 - 100 (value = raw x scale + offset, the formula the live agent uses); an earlier offset of -1000 produced readings near -850 C.] |
| `backup_ups_power_w` | Backup (UPS) Output Power | 119 | R119 | W |  | 5 s | Reg 119 UPS (backup) power, 1 W. |
| `inverter_l1_voltage_v` | Output Voltage L1 | 154 | (R154) × 0.1 | V |  | 5 s | Reg 154 inverter output voltage L1-N, 0.1 V. |
| `inverter_l1_current_a` | Output Current L1 | 164 | (int16(R164)) × 0.01 | A |  | 5 s | Reg 164 inverter output current L1, signed, 0.01 A. |
| `inverter_l1_power_w` | Output Power L1 | 173 | int16(R173) | W |  | 5 s | Reg 173 inverter output L1 power, signed, 1 W. |
| `inverter_output_power_w` | Output Power (Total) | 175 | int16(R175) | W |  | 5 s | Reg 175 inverter output total power, signed, 1 W. |
| `inverter_output_frequency_hz` | Output Frequency | 193 | (R193) × 0.01 | Hz |  | 5 s | Reg 193 inverter output frequency, 0.01 Hz. |
| `inverter_temperature_status` | Inverter Temperature Status |  | Derived by the platform (see Notes) |  |  | 30 s | Derived from the radiator (reg 90) and IGBT (reg 91) temperatures. No register. |

### Overview (15)

| Key | Name | Reg | Formula | Unit | Valid range | Every | Notes |
|---|---|---|---|---|---|---|---|
| `inverter_run_state` | Inverter Status | 59 | R59, then look up in enum inverter_state |  | 0 … 5 | 5 s | Reg 59 run state: 0 standby, 1 self-check, 2 normal, 3 alarm, 4 fault. |
| `day_grid_import_energy_kwh` | Imported Today | 76 | (R76) × 0.1 | kWh |  | 30 s | Reg 76 day grid-buy energy, 0.1 kWh. |
| `day_grid_export_energy_kwh` | Exported Today | 77 | (R77) × 0.1 | kWh |  | 30 s | Reg 77 day grid-sell energy, 0.1 kWh. |
| `day_load_energy_kwh` | Consumption Today | 84 | (R84) × 0.1 | kWh |  | 30 s | Reg 84 day load energy, 0.1 kWh. |
| `day_pv_energy_kwh` | Production Today | 108 | (R108) × 0.1 | kWh |  | 30 s | Reg 108 day PV energy, 0.1 kWh. |
| `grid_total_power_w` | Grid Power Now | 169 | int16(R169) | W |  | 5 s | Reg 169 grid-side total power, signed, 1 W (>0 buy, <0 sell). Unit is 10 W when reg 54 = 0. |
| `load_total_power_w` | Home Load Now | 178 | int16(R178) | W |  | 5 s | Reg 178 load-side total power, signed, 1 W. Unit is 10 W when reg 54 = 0. |
| `battery_soc_pct` | Battery Level | 184 | R184 | % | 0 … 100 | 5 s | Reg 184 battery capacity (SOC), 1 %. |
| `battery_power_w` | Battery Power | 190 | int16(R190) | W |  | 5 s | Reg 190 battery output power, signed, 1 W (positive = discharging, negative = charging). Unit is 10 W when reg 54 = 0. |
| `work_mode` | Work Mode | 244 | R244, then look up in enum export_limit_mode |  | 0 … 2 | 5 min | Reg 244 limit control function: 0 sell to grid, 1 built-in limiter, 2 external limiter. |
| `day_co2_saved_kg` | CO₂ Saved Today |  | Derived by the platform (see Notes) | kg |  | 30 s | Derived: day_pv_energy_kwh x grid emission factor. No register. |
| `day_self_use_pct` | Self Use Today |  | Derived by the platform (see Notes) | % |  | 30 s | Derived: (day_pv - day_grid_export) / day_pv x 100. No register. |
| `pv_total_power_w` | Solar Production Now |  | Derived by the platform (see Notes) | W |  | 30 s | Derived: PV1 + PV2 + PV3 power (regs 186-188). No register of its own. |
| `weather_condition` | Weather |  | Derived by the platform (see Notes) |  |  | 15 min | Weather API for the site location; no register. |
| `weather_temperature_c` | Outside Temperature |  | Derived by the platform (see Notes) | °C |  | 15 min | Weather API for the site location; no register. |

### Production (3)

| Key | Name | Reg | Formula | Unit | Valid range | Every | Notes |
|---|---|---|---|---|---|---|---|
| `peak_pv_power_today_w` | Peak Solar Power Today |  | Derived by the platform (see Notes) | W |  | 30 s | Derived: highest pv_total_power_w since midnight. |
| `production_chart_24h` | Production Curve Today |  | Derived by the platform (see Notes) | W |  | 30 s | Derived series from stored pv_total_power_w polls. |
| `specific_yield_day_kwh_kwp` | Yield per kWp Today |  | Derived by the platform (see Notes) | kWh/kWp |  | 30 s | Derived: day_pv_energy_kwh / installed kWp. |

### Savings & Environment (3)

| Key | Name | Reg | Formula | Unit | Valid range | Every | Notes |
|---|---|---|---|---|---|---|---|
| `co2_saved_kg` | CO₂ Saved |  | Derived by the platform (see Notes) | kg |  | 30 s | Derived from production and the grid emission factor. |
| `savings_amount` | Savings |  | Derived by the platform (see Notes) | ₹ |  | 30 s | Derived from load, import / export energy and tariffs. |
| `trees_equivalent` | Equivalent Trees Planted |  | Derived by the platform (see Notes) | trees |  | 30 s | Derived: co2_saved_kg / kg CO2 per tree per year. |

### Self Use (2)

| Key | Name | Reg | Formula | Unit | Valid range | Every | Notes |
|---|---|---|---|---|---|---|---|
| `self_consumption_pct` | Self Consumption |  | Derived by the platform (see Notes) | % |  | 30 s | Derived: (pv - grid export) / pv over the chosen period. |
| `self_sufficiency_pct` | Self Sufficiency |  | Derived by the platform (see Notes) | % |  | 30 s | Derived: (load - grid import) / load over the chosen period. |

### Service (7)

| Key | Name | Reg | Formula | Unit | Valid range | Every | Notes |
|---|---|---|---|---|---|---|---|
| `installation_date` | Installation Date |  | Derived by the platform (see Notes) |  |  | 24 h | Site / installation record. |
| `installation_date` | Installation Date |  | Derived by the platform (see Notes) |  |  | 24 h | Site / installation record. |
| `next_service_date` | Next Service Due |  | Derived by the platform (see Notes) |  |  | 24 h | Site / service record. |
| `next_service_date` | Next Service Due |  | Derived by the platform (see Notes) |  |  | 24 h | Site / service record. |
| `settings_change_history` | Settings Change History |  | Derived by the platform (see Notes) |  |  | 24 h | Platform write log (equipment_configs). |
| `warranty_end_date` | Warranty Valid Until |  | Derived by the platform (see Notes) |  |  | 24 h | Warranty record on the equipment row. |
| `warranty_end_date` | Warranty Valid Until |  | Derived by the platform (see Notes) |  |  | 24 h | Warranty record on the equipment row. |

### Solar Array (7)

| Key | Name | Reg | Formula | Unit | Valid range | Every | Notes |
|---|---|---|---|---|---|---|---|
| `total_pv_energy_kwh` | Solar Production Total | 96, 97 | (R96 + R97 × 65536) × 0.1 | kWh |  | 30 s | Regs 96 (low) / 97 (high) history PV energy, 0.1 kWh. |
| `pv1_voltage_v` | PV1 Voltage | 109 | (R109) × 0.1 | V |  | 5 s | Reg 109 DC voltage 1, 0.1 V. |
| `pv1_current_a` | PV1 Current | 110 | (R110) × 0.1 | A |  | 5 s | Reg 110 DC current 1, 0.1 A. |
| `pv2_voltage_v` | PV2 Voltage | 111 | (R111) × 0.1 | V |  | 5 s | Reg 111 DC voltage 2, 0.1 V. |
| `pv2_current_a` | PV2 Current | 112 | (R112) × 0.1 | A |  | 5 s | Reg 112 DC current 2, 0.1 A. |
| `pv1_power_w` | PV1 Power | 186 | R186 | W |  | 5 s | Reg 186 PV1 input power, 1 W (hybrid real-time area). |
| `pv2_power_w` | PV2 Power | 187 | R187 | W |  | 5 s | Reg 187 PV2 input power, 1 W. |

### Solar Array Comparison (1)

| Key | Name | Reg | Formula | Unit | Valid range | Every | Notes |
|---|---|---|---|---|---|---|---|
| `pv_input_share_pct` | Share of Production per PV Input |  | Derived by the platform (see Notes) | % |  | 30 s | Derived: pvN_power_w / pv_total_power_w for each input. |

### System Checks (6)

| Key | Name | Reg | Formula | Unit | Valid range | Every | Notes |
|---|---|---|---|---|---|---|---|
| `generator_phase_error` | Generator Phase Check | 93 | (R93 & 0x0004) >> 2 |  |  | 10 s | Reg 93 bit 2: 0 generator phase correct, 1 generator phase error. |
| `grid_phase_error` | Grid Phase Check | 93 | (R93 & 0x0002) >> 1 |  |  | 10 s | Reg 93 bit 1: 0 grid phase correct, 1 grid phase error. |
| `battery_communication_status` | Battery Communication | 100 | (R100 & 0x0300) >> 8 |  |  | 10 s | Reg 100 test-flag bits: bit 8 = Li-ion RS485 link OK, bit 9 = Li-ion CAN link OK (1 = normal). |
| `clock_out_of_sync` | Clock Out of Sync |  | Derived by the platform (see Notes) |  |  | 30 s | Derived: \|inverter_date_time - now\| > 2 minutes. |
| `inverter_overheat_warning` | Inverter Overheat |  | Derived by the platform (see Notes) |  |  | 30 s | Derived: heat-sink temperature above safe limit, or fault F64. |
| `last_data_received_at` | Last Data Received |  | Derived by the platform (see Notes) |  |  | 5 s | Platform timestamp of the last successful read; no register. |

## 4. Write registers (66)

Only these can be changed from the platform. Customers see the ones with `show_for_user`; the rest are for installers and admins. Rows with no register are stored by the platform (tariffs, notification choices) and never sent to the inverter.

### Account (3)

| Key | Name | Reg | Formula | Unit | Valid range | Every | Notes |
|---|---|---|---|---|---|---|---|
| `export_tariff_per_kwh` | Export Tariff |  | Derived by the platform (see Notes) | ₹/kWh |  | 24 h | Customer entry stored by the platform; not an inverter register. |
| `import_tariff_per_kwh` | Import Tariff |  | Derived by the platform (see Notes) | ₹/kWh |  | 24 h | Customer entry stored by the platform; not an inverter register. |
| `notifications` | Notifications (faults, power cut, battery low, offline) |  | Derived by the platform (see Notes) |  |  | 24 h | Customer entry stored by the platform; not an inverter register. |

### Energy mode (3)

| Key | Name | Reg | Formula | Unit | Valid range | Every | Notes |
|---|---|---|---|---|---|---|---|
| `battery_low_soc_pct` | Battery Low Level (Backup Reserve) | 219 | R219 | % | 0 … 100 | 5 min | Reg 219 battery capacity LowBatt (discharge depth), 1 %. |
| `energy_priority_mode` | Energy Priority | 243 | R243, then look up in enum energy_management_mode |  | 0 … 1 | 5 min | Reg 243 energy management mode: 0 battery priority, 1 load priority. |
| `solar_sell_enabled` | Sell Solar to Grid | 247 | R247 != 0 |  | 0 … 1 | 5 min | Reg 247 solar sell: 0 don't sell, 1 sell. |

### Generator charging (4)

| Key | Name | Reg | Formula | Unit | Valid range | Every | Notes |
|---|---|---|---|---|---|---|---|
| `generator_charge_start_voltage_v` | Start Generator Charging Below (Voltage) | 225 | (R225) × 0.01 | V | 0 … 63 | 5 min | Reg 225 generator charging start voltage, 0.01 V (PDF range 0-6300). |
| `generator_charge_start_soc_pct` | Start Generator Charging Below | 226 | R226 | % | 0 … 100 | 5 min | Reg 226 generator charging start capacity, 1 %. |
| `generator_charge_current_a` | Generator Charging Current | 227 | R227 | A | 0 … 185 | 5 min | Reg 227 generator-to-battery charge current, 1 A, 0-185. |
| `generator_charge_enabled` | Charge Battery from Generator | 231 | R231 != 0 |  | 0 … 1 | 5 min | Reg 231 generator charge enable (0/1). |

### Grid charging (4)

| Key | Name | Reg | Formula | Unit | Valid range | Every | Notes |
|---|---|---|---|---|---|---|---|
| `grid_charge_start_voltage_v` | Start Grid Charging Below (Voltage) | 228 | (R228) × 0.01 | V | 0 … 63 | 5 min | Reg 228 grid charging start voltage, 0.01 V (PDF range 0-6300). |
| `grid_charge_start_soc_pct` | Start Grid Charging Below | 229 | R229 | % | 0 … 100 | 5 min | Reg 229 grid charging start capacity, 1 %. |
| `grid_charge_current_a` | Grid Charging Current | 230 | R230 | A | 0 … 185 | 5 min | Reg 230 grid-to-battery charge current, 1 A, 0-185. |
| `grid_charge_enabled` | Charge Battery from Grid | 232 | R232 != 0 |  | 0 … 1 | 5 min | Reg 232 grid charge enable (0/1). |

### Grid peak shaving (2)

| Key | Name | Reg | Formula | Unit | Valid range | Every | Notes |
|---|---|---|---|---|---|---|---|
| `grid_peak_shaving_enabled` | Limit Power from Grid | 280 | (R280 & 0x0F00) >> 8 != 0 |  |  | 5 min | Reg 280 bits 8-11: 0 grid peak-shaving disabled, 1 enabled. Shared register - read-modify-write, keep the other bits unchanged. |
| `grid_peak_shaving_power_w` | Grid Power Limit | 293 | R293 | W | 0 … 16000 | 5 min | Reg 293 grid peak-shaving power, 1 W, 0-16000. |

### Preferences (3)

| Key | Name | Reg | Formula | Unit | Valid range | Every | Notes |
|---|---|---|---|---|---|---|---|
| `low_noise_mode_enabled` | Quiet Mode | 34 | R34 != 0 |  | 0 … 1 | 5 min | Reg 34 low-noise mode: 1 enable, 0 disable (added in V119). |
| `inverter_beep_enabled` | Inverter Beep | 330 | (R330 & 0x000C) >> 2 != 0 |  |  | 5 min | Reg 330 bits 2-3 (communication board): 11 = on, 10 = off, 00/01 = no action. Shared register - keep the other bits unchanged. |
| `inverter_screen_auto_dim_enabled` | Screen Auto-dim | 330 | (R330 & 0x00C0) >> 6 != 0 |  |  | 5 min | Reg 330 bits 6-7 (communication board): 11 = on, 10 = off, 00/01 = no action. Shared register - keep the other bits unchanged. |

### Smart load (2)

| Key | Name | Reg | Formula | Unit | Valid range | Every | Notes |
|---|---|---|---|---|---|---|---|
| `smart_load_off_soc_pct` | Smart Load OFF at | 237 | R237 | % | 0 … 100 | 5 min | Reg 237 smart-load OFF battery capacity, 1 %. |
| `smart_load_on_soc_pct` | Smart Load ON at | 239 | R239 | % | 0 … 100 | 5 min | Reg 239 smart-load ON battery capacity, 1 %. |

### Time of Use (44)

| Key | Name | Reg | Formula | Unit | Valid range | Every | Notes |
|---|---|---|---|---|---|---|---|
| `time_of_use_enabled` | Time of Use | 248 | R248 & 0x0001 != 0 |  |  | 5 min | Reg 248 bit 0: time-of-use selling master enable. Shared with the weekday bits - read-modify-write. |
| `time_of_use_friday_enabled` | Time of Use on Friday | 248 | (R248 & 0x0020) >> 5 != 0 |  |  | 5 min | Reg 248 bit 5: time-of-use enabled on friday. Shared register - read-modify-write. |
| `time_of_use_monday_enabled` | Time of Use on Monday | 248 | (R248 & 0x0002) >> 1 != 0 |  |  | 5 min | Reg 248 bit 1: time-of-use enabled on monday. Shared register - read-modify-write. |
| `time_of_use_saturday_enabled` | Time of Use on Saturday | 248 | (R248 & 0x0040) >> 6 != 0 |  |  | 5 min | Reg 248 bit 6: time-of-use enabled on saturday. Shared register - read-modify-write. |
| `time_of_use_sunday_enabled` | Time of Use on Sunday | 248 | (R248 & 0x0080) >> 7 != 0 |  |  | 5 min | Reg 248 bit 7: time-of-use enabled on sunday. Shared register - read-modify-write. |
| `time_of_use_thursday_enabled` | Time of Use on Thursday | 248 | (R248 & 0x0010) >> 4 != 0 |  |  | 5 min | Reg 248 bit 4: time-of-use enabled on thursday. Shared register - read-modify-write. |
| `time_of_use_tuesday_enabled` | Time of Use on Tuesday | 248 | (R248 & 0x0004) >> 2 != 0 |  |  | 5 min | Reg 248 bit 2: time-of-use enabled on tuesday. Shared register - read-modify-write. |
| `time_of_use_wednesday_enabled` | Time of Use on Wednesday | 248 | (R248 & 0x0008) >> 3 != 0 |  |  | 5 min | Reg 248 bit 3: time-of-use enabled on wednesday. Shared register - read-modify-write. |
| `time_of_use_slot1_start_time` | Slot 1 Start Time | 250 | Special packing (see Notes) | HH:MM |  | 5 min | Reg 250 sell-mode time point 1, HHMM (2359 = 23:59). MCU works in 5-min steps (0-287). |
| `time_of_use_slot2_start_time` | Slot 2 Start Time | 251 | Special packing (see Notes) | HH:MM |  | 5 min | Reg 251 sell-mode time point 2, HHMM (2359 = 23:59). MCU works in 5-min steps (0-287). |
| `time_of_use_slot3_start_time` | Slot 3 Start Time | 252 | Special packing (see Notes) | HH:MM |  | 5 min | Reg 252 sell-mode time point 3, HHMM (2359 = 23:59). MCU works in 5-min steps (0-287). |
| `time_of_use_slot4_start_time` | Slot 4 Start Time | 253 | Special packing (see Notes) | HH:MM |  | 5 min | Reg 253 sell-mode time point 4, HHMM (2359 = 23:59). MCU works in 5-min steps (0-287). |
| `time_of_use_slot5_start_time` | Slot 5 Start Time | 254 | Special packing (see Notes) | HH:MM |  | 5 min | Reg 254 sell-mode time point 5, HHMM (2359 = 23:59). MCU works in 5-min steps (0-287). |
| `time_of_use_slot6_start_time` | Slot 6 Start Time | 255 | Special packing (see Notes) | HH:MM |  | 5 min | Reg 255 sell-mode time point 6, HHMM (2359 = 23:59). MCU works in 5-min steps (0-287). |
| `time_of_use_slot1_power_w` | Slot 1 Battery Power | 256 | R256 | W | 0 … 8000 | 5 min | Reg 256 sell-mode time point 1 power, 1 W, 0-8000 (limited by battery max discharge power). |
| `time_of_use_slot2_power_w` | Slot 2 Battery Power | 257 | R257 | W | 0 … 8000 | 5 min | Reg 257 sell-mode time point 2 power, 1 W, 0-8000 (limited by battery max discharge power). |
| `time_of_use_slot3_power_w` | Slot 3 Battery Power | 258 | R258 | W | 0 … 8000 | 5 min | Reg 258 sell-mode time point 3 power, 1 W, 0-8000 (limited by battery max discharge power). |
| `time_of_use_slot4_power_w` | Slot 4 Battery Power | 259 | R259 | W | 0 … 8000 | 5 min | Reg 259 sell-mode time point 4 power, 1 W, 0-8000 (limited by battery max discharge power). |
| `time_of_use_slot5_power_w` | Slot 5 Battery Power | 260 | R260 | W | 0 … 8000 | 5 min | Reg 260 sell-mode time point 5 power, 1 W, 0-8000 (limited by battery max discharge power). |
| `time_of_use_slot6_power_w` | Slot 6 Battery Power | 261 | R261 | W | 0 … 8000 | 5 min | Reg 261 sell-mode time point 6 power, 1 W, 0-8000 (limited by battery max discharge power). |
| `time_of_use_slot1_battery_voltage_v` | Slot 1 Battery Voltage | 262 | (R262) × 0.01 | V | 0 … 63 | 5 min | Reg 262 time point 1 battery voltage target, 0.01 V (PDF range 0-6300). |
| `time_of_use_slot2_battery_voltage_v` | Slot 2 Battery Voltage | 263 | (R263) × 0.01 | V | 0 … 63 | 5 min | Reg 263 time point 2 battery voltage target, 0.01 V (PDF range 0-6300). |
| `time_of_use_slot3_battery_voltage_v` | Slot 3 Battery Voltage | 264 | (R264) × 0.01 | V | 0 … 63 | 5 min | Reg 264 time point 3 battery voltage target, 0.01 V (PDF range 0-6300). |
| `time_of_use_slot4_battery_voltage_v` | Slot 4 Battery Voltage | 265 | (R265) × 0.01 | V | 0 … 63 | 5 min | Reg 265 time point 4 battery voltage target, 0.01 V (PDF range 0-6300). |
| `time_of_use_slot5_battery_voltage_v` | Slot 5 Battery Voltage | 266 | (R266) × 0.01 | V | 0 … 63 | 5 min | Reg 266 time point 5 battery voltage target, 0.01 V (PDF range 0-6300). |
| `time_of_use_slot6_battery_voltage_v` | Slot 6 Battery Voltage | 267 | (R267) × 0.01 | V | 0 … 63 | 5 min | Reg 267 time point 6 battery voltage target, 0.01 V (PDF range 0-6300). |
| `time_of_use_slot1_battery_soc_pct` | Slot 1 Battery Level | 268 | R268 | % | 0 … 100 | 5 min | Reg 268 time point 1 battery SOC target, 1 %. |
| `time_of_use_slot2_battery_soc_pct` | Slot 2 Battery Level | 269 | R269 | % | 0 … 100 | 5 min | Reg 269 time point 2 battery SOC target, 1 %. |
| `time_of_use_slot3_battery_soc_pct` | Slot 3 Battery Level | 270 | R270 | % | 0 … 100 | 5 min | Reg 270 time point 3 battery SOC target, 1 %. |
| `time_of_use_slot4_battery_soc_pct` | Slot 4 Battery Level | 271 | R271 | % | 0 … 100 | 5 min | Reg 271 time point 4 battery SOC target, 1 %. |
| `time_of_use_slot5_battery_soc_pct` | Slot 5 Battery Level | 272 | R272 | % | 0 … 100 | 5 min | Reg 272 time point 5 battery SOC target, 1 %. |
| `time_of_use_slot6_battery_soc_pct` | Slot 6 Battery Level | 273 | R273 | % | 0 … 100 | 5 min | Reg 273 time point 6 battery SOC target, 1 %. |
| `time_of_use_slot1_generator_charge_enabled` | Slot 1 Charge from Generator | 274 | (R274 & 0x0002) >> 1 != 0 |  |  | 5 min | Reg 274 bit 1: generator charge enable for time point 1. Shared register - read-modify-write. |
| `time_of_use_slot1_grid_charge_enabled` | Slot 1 Charge from Grid | 274 | R274 & 0x0001 != 0 |  |  | 5 min | Reg 274 bit 0: grid charge enable for time point 1. Shared with generator-charge (bit 1) and GM/BU/CH mode bits - read-modify-write. |
| `time_of_use_slot2_generator_charge_enabled` | Slot 2 Charge from Generator | 275 | (R275 & 0x0002) >> 1 != 0 |  |  | 5 min | Reg 275 bit 1: generator charge enable for time point 2. Shared register - read-modify-write. |
| `time_of_use_slot2_grid_charge_enabled` | Slot 2 Charge from Grid | 275 | R275 & 0x0001 != 0 |  |  | 5 min | Reg 275 bit 0: grid charge enable for time point 2. Shared with generator-charge (bit 1) and GM/BU/CH mode bits - read-modify-write. |
| `time_of_use_slot3_generator_charge_enabled` | Slot 3 Charge from Generator | 276 | (R276 & 0x0002) >> 1 != 0 |  |  | 5 min | Reg 276 bit 1: generator charge enable for time point 3. Shared register - read-modify-write. |
| `time_of_use_slot3_grid_charge_enabled` | Slot 3 Charge from Grid | 276 | R276 & 0x0001 != 0 |  |  | 5 min | Reg 276 bit 0: grid charge enable for time point 3. Shared with generator-charge (bit 1) and GM/BU/CH mode bits - read-modify-write. |
| `time_of_use_slot4_generator_charge_enabled` | Slot 4 Charge from Generator | 277 | (R277 & 0x0002) >> 1 != 0 |  |  | 5 min | Reg 277 bit 1: generator charge enable for time point 4. Shared register - read-modify-write. |
| `time_of_use_slot4_grid_charge_enabled` | Slot 4 Charge from Grid | 277 | R277 & 0x0001 != 0 |  |  | 5 min | Reg 277 bit 0: grid charge enable for time point 4. Shared with generator-charge (bit 1) and GM/BU/CH mode bits - read-modify-write. |
| `time_of_use_slot5_generator_charge_enabled` | Slot 5 Charge from Generator | 278 | (R278 & 0x0002) >> 1 != 0 |  |  | 5 min | Reg 278 bit 1: generator charge enable for time point 5. Shared register - read-modify-write. |
| `time_of_use_slot5_grid_charge_enabled` | Slot 5 Charge from Grid | 278 | R278 & 0x0001 != 0 |  |  | 5 min | Reg 278 bit 0: grid charge enable for time point 5. Shared with generator-charge (bit 1) and GM/BU/CH mode bits - read-modify-write. |
| `time_of_use_slot6_generator_charge_enabled` | Slot 6 Charge from Generator | 279 | (R279 & 0x0002) >> 1 != 0 |  |  | 5 min | Reg 279 bit 1: generator charge enable for time point 6. Shared register - read-modify-write. |
| `time_of_use_slot6_grid_charge_enabled` | Slot 6 Charge from Grid | 279 | R279 & 0x0001 != 0 |  |  | 5 min | Reg 279 bit 0: grid charge enable for time point 6. Shared with generator-charge (bit 1) and GM/BU/CH mode bits - read-modify-write. |

### Clock (1)

| Key | Name | Reg | Formula | Unit | Valid range | Every | Notes |
|---|---|---|---|---|---|---|---|
| `inverter_date_time` | Inverter Date & Time | 22, 23, 24 | Special packing (see Notes) |  |  | 5 min | Regs 22-24 system time (6 bytes: year since 2000, month, day, hour, minute, second). Write all three registers in one 0x10 request. |

## 5. Cross-check against the 10 Sep 2026 register sweep

For every read register that has a single-word rule and answered in the sweep, the raw word from the sweep was pushed through the formula above and compared with the value the sweep itself reported. "Agrees" means the two decodings match to rounding.

* **54** registers agree.
* **2** decode differently (listed below).
* **2** registers did not answer in the sweep (listed below): the metric exists in the catalogue, but the inverter returned no data for it on that day.

### Registers that decode differently

| Key | Reg | Raw | Catalogue formula gives | Sweep reported |
|---|---|---|---|---|
| `inverter_ac_temperature_c` | 91 | 1444 (0x05A4) | 44.4 | 144.4 |
| `inverter_dc_temperature_c` | 90 | 1504 (0x05E0) | 50.4 | 150.4 |

### Registers that did not answer

| Key | Reg | Metric group |
|---|---|---|
| `battery_pack1_soc_pct` | 603 | Battery |
| `battery_pack1_cycle_count` | 611 | Battery Health |

## 6. Writing: the rules the backend enforces

1. The metric must exist for this equipment with `direction = write` and a register (a row with no register is a platform setting).
2. The caller must be allowed: a customer only for `show_for_user = true`, and only if the plan has `instrument_settings`; an installer or admin for all.
3. The value must be inside `valid_min .. valid_max` and have the right kind (on/off, a number, an HHMM time, a code that exists in the enum).
4. Shared registers (a bit mask in the decode) are written by read-modify-write of only that field.
5. The write is sent once, with a command id; the ESP32 reads the register back and reports **what the inverter now holds**. The platform shows the read-back value, never the requested one.
6. If the read-back differs, or the inverter does not answer, the result is recorded as failed together with what the inverter still holds.
7. Writes are rate-limited per device (the inverter keeps settings in flash: do not write the same value again, do not write in a loop).

## 7. Enums used by these registers

| Enum | Codes |
|---|---|
| `batt_control_mode` | 0=By voltage; 1=By SOC; 2=No battery |
| `battery_type` | 0=Lead-acid; 1=Lithium |
| `energy_management_mode` | 0=Battery priority; 1=Load priority |
| `export_limit_mode` | 0=Sell to grid; 1=Limit via built-in CT; 2=Limit via external meter |
| `gen_port_function` | 0=Generator input; 1=Smart-load output; 2=Micro-inverter input |
| `grid_frequency_setting` | 0=50 Hz; 1=60 Hz |
| `grid_standard` | 1=INMETRO; 10=G98_G99; 11=AS4777; 12=NB/T 32004; 13=AS4777.2 Australia A; 14=AS4777.2 Australia B; 15=AS4777.2 Australia C; 16=AS4777.2 New Zealand; 17=MEA; 18=PEA; 19=EN50549 (repeated — see note); 2=EN50549; 20=VDE4105; 21=R25; 22=CEI-016; 3=EN50438; 4=IEC61727; 5=CUSTOM; 6=VDE_AR_N_4105; 7=UTE_C15_712_1; 8=RD_1699; 9=CEI_0_21 |
| `grid_type` | 0=Single-phase; 1=Split-phase 120/240V; 2=Three-phase 208V/120V; 3=120V single-phase |
| `inverter_state` | 0=Standby; 1=Self-check; 2=Normal; 3=Alarm; 4=Fault (V1) / Failure (V133); 5=Activating (V1) / Turn off (V133) |

The full fault and warning code table (`fault_code` 29 rows, `warning_code` 4 rows) is in `waytara.equipment_enum`, with the customer wording in `apps/web/src/lib/deye-fault-codes.ts`.

## 8. Findings (things that would give wrong numbers if left as they are)

1. **Fault, warning and alarm words are stored as a plain number, and the dashboard reads that number as the fault code.** R101 to R106 and R117, R118 are bit sets (one bit per code, section 2). A single fault `F13` arrives as the word with one bit set, not as the number 13, so `faultCodeOf()` in the web app would show a wrong or unknown code. The backend must turn each word into a list of codes (new decode rule `bitset`), store the list, and the `fault_code` / `warning_code` enum rows then give the names. *The bit-to-code order above (bit 0 of R103 = F01) is the one I know from Deye's tables; check it once against the fault table in the inverter manual before shipping.*
2. **Registers that only accept commands cannot show a state.** Beep (R330 bits 2 and 3) and screen auto-dim (R330 bits 6 and 7) are command bits ("11 = on, 10 = off, 00 or 01 = no action"). Reading them back returns "no action", so the dashboard shows "off" whatever the inverter does. Until a real state register is found, show these as "last sent", not as the inverter's state.
3. **The sweep spreadsheet decoded the two inverter temperatures wrongly** (144.4 °C and 150.4 °C). The catalogue is right: Deye sends `(raw − 1000) / 10`, which is `R × 0.1 − 100` (44.4 °C and 50.4 °C). Do not reuse the sweep's own decoded column.
4. **The generator energy counter (R92 with R95) is unverified and the sweep disagrees with it.** The sweep labels R92 `sd_status` and R95 `environment_temp_c`. A counter built from those two words would be nonsense. Keep it hidden until a real reading with a generator connected, or the manual's table, confirms the pair.
5. **Two registers never answered in the sweep:** R603 (battery pack 1 state of charge) and R611 (pack 1 cycle count). A register that does not answer must be stored as "no data" with a quality flag, never as 0 and never as the last value with a fresh time.
6. **R79 sits inside the grid-import counter's range** (the counter is R78 low and R80 high) and holds the grid frequency (5008 = 50.08 Hz). That is correct, and it is why the two words are not adjacent: the backend must read registers by the list in the catalogue, never by assuming a counter's two words are neighbours.
7. **41 of 375 read metrics and 24 of 63 write metrics are not marked verified** (section 9); 29 of them are visible to customers. A metric should only be visible to a customer after it has been confirmed against the manual or a live cross-check.
8. **31 read metrics are derived** (no register): energy shares, CO₂, savings, backup time, round-trip efficiency and so on. Their formulas are in the Notes column. They must be computed in the backend from stored, verified values, and left empty when an input is missing.
9. **Special packings are only described in text** (serial number, date and time, HHMM times). The backend needs real code for them, with tests, instead of relying on the number.


## 9. Metrics not yet marked verified

Treat these as probably right, not proven.

### 9a. Visible to customers today (29)

These are the ones to hide or prove first. Each is a bit-field register or a register whose meaning the manual does not tabulate. The settings that disagreed with the inverter screen on the photos (time-of-use master and slot flags, peak shaving, beep, auto-dim) are all in this list.

| Key | Direction | Reg | Notes |
|---|---|---|---|
| `inverter_date_time` | write | 22, 23, 24 | Regs 22-24 system time (6 bytes: year since 2000, month, day, hour, minute, second). Write all three registers in one 0x10 request. |
| `generator_phase_error` | read | 93 | Reg 93 bit 2: 0 generator phase correct, 1 generator phase error. |
| `grid_phase_error` | read | 93 | Reg 93 bit 1: 0 grid phase correct, 1 grid phase error. |
| `battery_communication_status` | read | 100 | Reg 100 test-flag bits: bit 8 = Li-ion RS485 link OK, bit 9 = Li-ion CAN link OK (1 = normal). |
| `battery_charge_status` | read | 185 | Reg 185 'battery status'. The PDF does not tabulate its values; no enum attached. |
| `time_of_use_enabled` | write | 248 | Reg 248 bit 0: time-of-use selling master enable. Shared with the weekday bits - read-modify-write. |
| `time_of_use_friday_enabled` | write | 248 | Reg 248 bit 5: time-of-use enabled on friday. Shared register - read-modify-write. |
| `time_of_use_monday_enabled` | write | 248 | Reg 248 bit 1: time-of-use enabled on monday. Shared register - read-modify-write. |
| `time_of_use_saturday_enabled` | write | 248 | Reg 248 bit 6: time-of-use enabled on saturday. Shared register - read-modify-write. |
| `time_of_use_sunday_enabled` | write | 248 | Reg 248 bit 7: time-of-use enabled on sunday. Shared register - read-modify-write. |
| `time_of_use_thursday_enabled` | write | 248 | Reg 248 bit 4: time-of-use enabled on thursday. Shared register - read-modify-write. |
| `time_of_use_tuesday_enabled` | write | 248 | Reg 248 bit 2: time-of-use enabled on tuesday. Shared register - read-modify-write. |
| `time_of_use_wednesday_enabled` | write | 248 | Reg 248 bit 3: time-of-use enabled on wednesday. Shared register - read-modify-write. |
| `time_of_use_slot1_generator_charge_enabled` | write | 274 | Reg 274 bit 1: generator charge enable for time point 1. Shared register - read-modify-write. |
| `time_of_use_slot1_grid_charge_enabled` | write | 274 | Reg 274 bit 0: grid charge enable for time point 1. Shared with generator-charge (bit 1) and GM/BU/CH mode bits - read-modify-write. |
| `time_of_use_slot2_generator_charge_enabled` | write | 275 | Reg 275 bit 1: generator charge enable for time point 2. Shared register - read-modify-write. |
| `time_of_use_slot2_grid_charge_enabled` | write | 275 | Reg 275 bit 0: grid charge enable for time point 2. Shared with generator-charge (bit 1) and GM/BU/CH mode bits - read-modify-write. |
| `time_of_use_slot3_generator_charge_enabled` | write | 276 | Reg 276 bit 1: generator charge enable for time point 3. Shared register - read-modify-write. |
| `time_of_use_slot3_grid_charge_enabled` | write | 276 | Reg 276 bit 0: grid charge enable for time point 3. Shared with generator-charge (bit 1) and GM/BU/CH mode bits - read-modify-write. |
| `time_of_use_slot4_generator_charge_enabled` | write | 277 | Reg 277 bit 1: generator charge enable for time point 4. Shared register - read-modify-write. |
| `time_of_use_slot4_grid_charge_enabled` | write | 277 | Reg 277 bit 0: grid charge enable for time point 4. Shared with generator-charge (bit 1) and GM/BU/CH mode bits - read-modify-write. |
| `time_of_use_slot5_generator_charge_enabled` | write | 278 | Reg 278 bit 1: generator charge enable for time point 5. Shared register - read-modify-write. |
| `time_of_use_slot5_grid_charge_enabled` | write | 278 | Reg 278 bit 0: grid charge enable for time point 5. Shared with generator-charge (bit 1) and GM/BU/CH mode bits - read-modify-write. |
| `time_of_use_slot6_generator_charge_enabled` | write | 279 | Reg 279 bit 1: generator charge enable for time point 6. Shared register - read-modify-write. |
| `time_of_use_slot6_grid_charge_enabled` | write | 279 | Reg 279 bit 0: grid charge enable for time point 6. Shared with generator-charge (bit 1) and GM/BU/CH mode bits - read-modify-write. |
| `grid_peak_shaving_enabled` | write | 280 | Reg 280 bits 8-11: 0 grid peak-shaving disabled, 1 enabled. Shared register - read-modify-write, keep the other bits unchanged. |
| `inverter_beep_enabled` | write | 330 | Reg 330 bits 2-3 (communication board): 11 = on, 10 = off, 00/01 = no action. Shared register - keep the other bits unchanged. |
| `inverter_screen_auto_dim_enabled` | write | 330 | Reg 330 bits 6-7 (communication board): 11 = on, 10 = off, 00/01 = no action. Shared register - keep the other bits unchanged. |
| `battery_firmware_version` | read | 419, 420 | Regs 419 (low) / 420 (high) lithium version number; for parallel batteries only the last unit is readable. |

### 9b. Not visible to customers (36)

| Key | Direction | Reg | Notes |
|---|---|---|---|
| `month_pv_energy_kwh` | read | 65 | Reg 65 month PV energy, 1 kWh. PDF also lists 'battery 1 current' (0.01 A) for this slot on some hybrid builds - confirm on hardware. [2026-10-05: hidden - this register  |
| `month_load_energy_kwh` | read | 66 | Reg 66 month load energy, 1 kWh. PDF also lists 'battery 2 current' (0.01 A) for this slot on some hybrid builds - confirm on hardware. [2026-10-05: hidden - this registe |
| `month_grid_export_energy_kwh` | read | 67 | Reg 67 month grid-sell energy, 1 kWh. PDF hybrid column shares this slot with other model variants - confirm on hardware. [2026-10-05: hidden - this register reads 0 on t |
| `generator_relay_status` | read | 195 | Reg 195 low nibble (bits 0-3): 0 open, 1 closed, 3 closed while generator running. Bits 4-7 = switch signal (0 off, 1 on). |
| `battery_pack1_soc_pct` | read | 603 | Pack 1 SOC, reg 603; PDF unit column says just '0.1' (assumed 0.1 %). Verify on hardware - if it reads 1 % per count, drop the scale. |
| `battery_pack2_soc_pct` | read | 617 | Pack 2 SOC, reg 617; PDF unit column says just '0.1' (assumed 0.1 %). Verify on hardware - if it reads 1 % per count, drop the scale. |
| `battery_pack3_soc_pct` | read | 631 | Pack 3 SOC, reg 631; PDF unit column says just '0.1' (assumed 0.1 %). Verify on hardware - if it reads 1 % per count, drop the scale. |
| `battery_pack4_soc_pct` | read | 645 | Pack 4 SOC, reg 645; PDF unit column says just '0.1' (assumed 0.1 %). Verify on hardware - if it reads 1 % per count, drop the scale. |
| `battery_pack5_soc_pct` | read | 659 | Pack 5 SOC, reg 659; PDF unit column says just '0.1' (assumed 0.1 %). Verify on hardware - if it reads 1 % per count, drop the scale. |
| `battery_pack6_soc_pct` | read | 673 | Pack 6 SOC, reg 673; PDF unit column says just '0.1' (assumed 0.1 %). Verify on hardware - if it reads 1 % per count, drop the scale. |
| `battery_pack7_soc_pct` | read | 687 | Pack 7 SOC, reg 687; PDF unit column says just '0.1' (assumed 0.1 %). Verify on hardware - if it reads 1 % per count, drop the scale. |
| `battery_pack8_soc_pct` | read | 701 | Pack 8 SOC, reg 701; PDF unit column says just '0.1' (assumed 0.1 %). Verify on hardware - if it reads 1 % per count, drop the scale. |
| `battery_pack9_soc_pct` | read | 715 | Pack 9 SOC, reg 715; PDF unit column says just '0.1' (assumed 0.1 %). Verify on hardware - if it reads 1 % per count, drop the scale. |
| `battery_pack10_soc_pct` | read | 729 | Pack 10 SOC, reg 729; PDF unit column says just '0.1' (assumed 0.1 %). Verify on hardware - if it reads 1 % per count, drop the scale. |
| `battery_pack11_soc_pct` | read | 743 | Pack 11 SOC, reg 743; PDF unit column says just '0.1' (assumed 0.1 %). Verify on hardware - if it reads 1 % per count, drop the scale. |
| `battery_pack12_soc_pct` | read | 757 | Pack 12 SOC, reg 757; PDF unit column says just '0.1' (assumed 0.1 %). Verify on hardware - if it reads 1 % per count, drop the scale. |
| `battery_pack13_soc_pct` | read | 771 | Pack 13 SOC, reg 771; PDF unit column says just '0.1' (assumed 0.1 %). Verify on hardware - if it reads 1 % per count, drop the scale. |
| `battery_pack14_soc_pct` | read | 785 | Pack 14 SOC, reg 785; PDF unit column says just '0.1' (assumed 0.1 %). Verify on hardware - if it reads 1 % per count, drop the scale. |
| `battery_pack15_soc_pct` | read | 799 | Pack 15 SOC, reg 799; PDF unit column says just '0.1' (assumed 0.1 %). Verify on hardware - if it reads 1 % per count, drop the scale. |
| `fault_history` | read | 1000 | Memory record table, regs 1000-1499 (inverter fault log, 500 words). Read as one block; address lists only the start register. |
| `fault_history` | read | 1000 | Memory record table, regs 1000-1499 (inverter fault log, 500 words). Read as one block; address lists only the start register. |
| `battery_pack1_soh_pct` | read | 10048 | Pack 1 SOH, Deye-battery block reg 10048; PDF unit '0.1' (assumed 0.1 %). Verify on hardware. |
| `battery_pack2_soh_pct` | read | 10078 | Pack 2 SOH, Deye-battery block reg 10078; PDF unit '0.1' (assumed 0.1 %). Verify on hardware. |
| `battery_pack3_soh_pct` | read | 10108 | Pack 3 SOH, Deye-battery block reg 10108; PDF unit '0.1' (assumed 0.1 %). Verify on hardware. |
| `battery_pack4_soh_pct` | read | 10138 | Pack 4 SOH, Deye-battery block reg 10138; PDF unit '0.1' (assumed 0.1 %). Verify on hardware. |
| `battery_pack5_soh_pct` | read | 10168 | Pack 5 SOH, Deye-battery block reg 10168; PDF unit '0.1' (assumed 0.1 %). Verify on hardware. |
| `battery_pack6_soh_pct` | read | 10198 | Pack 6 SOH, Deye-battery block reg 10198; PDF unit '0.1' (assumed 0.1 %). Verify on hardware. |
| `battery_pack7_soh_pct` | read | 10228 | Pack 7 SOH, Deye-battery block reg 10228; PDF unit '0.1' (assumed 0.1 %). Verify on hardware. |
| `battery_pack8_soh_pct` | read | 10258 | Pack 8 SOH, Deye-battery block reg 10258; PDF unit '0.1' (assumed 0.1 %). Verify on hardware. |
| `battery_pack9_soh_pct` | read | 10288 | Pack 9 SOH, Deye-battery block reg 10288; PDF unit '0.1' (assumed 0.1 %). Verify on hardware. |
| `battery_pack10_soh_pct` | read | 10318 | Pack 10 SOH, Deye-battery block reg 10318; PDF unit '0.1' (assumed 0.1 %). Verify on hardware. |
| `battery_pack11_soh_pct` | read | 10348 | Pack 11 SOH, Deye-battery block reg 10348; PDF unit '0.1' (assumed 0.1 %). Verify on hardware. |
| `battery_pack12_soh_pct` | read | 10378 | Pack 12 SOH, Deye-battery block reg 10378; PDF unit '0.1' (assumed 0.1 %). Verify on hardware. |
| `battery_pack13_soh_pct` | read | 10408 | Pack 13 SOH, Deye-battery block reg 10408; PDF unit '0.1' (assumed 0.1 %). Verify on hardware. |
| `battery_pack14_soh_pct` | read | 10438 | Pack 14 SOH, Deye-battery block reg 10438; PDF unit '0.1' (assumed 0.1 %). Verify on hardware. |
| `battery_pack15_soh_pct` | read | 10468 | Pack 15 SOH, Deye-battery block reg 10468; PDF unit '0.1' (assumed 0.1 %). Verify on hardware. |
