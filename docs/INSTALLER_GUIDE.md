# Setting up a WayTara monitoring unit (for installers)

For employees and site engineers. A customer does not do this. About 10 minutes per unit.

## Before you go
* An **Android phone with Chrome** (or Edge, or Samsung Internet). iPhones cannot do the Bluetooth step: use an Android phone or a Windows/Mac/Linux laptop with Chrome.
* Your WayTara login. You can only set up units for sites an admin has **assigned you to**; ask the office if the site is not in your list.
* The site's **Wi-Fi name and password** (2.4 GHz only: the unit cannot join a 5 GHz-only network). A phone hotspot works for a test, with "Maximize Compatibility" switched on.
* The unit powered by USB-C **or** the 7 to 36 V screw terminal, never both.

## Wire the inverter (Deye)
1. On the inverter use the RJ45 socket labelled **8 "Modbus"** (not 7 "RS485/METER", not 6 "BMS 485/CAN").
2. On that socket: pin 1 = B, pin 2 = A, pin 3 = GND. Connect them to the unit's **B**, **A** and **GND** terminals.
3. If the dashboard later says "the inverter is not answering the monitoring unit", the first thing to try is swapping A and B (it fixed the first unit we set up).
4. The inverter must be on, with Modbus ID 1 and 9600 baud (its defaults).

## Set the unit up
1. Open **https://setup.waytaraenergy.com** in Chrome and sign in.
2. **Device:** pick the inverter this unit is wired to (the list shows only the devices you may set up).
3. **Unit:** press **Find my unit** and choose the one named **WayTara-…** in Chrome's list. A brand new unit is visible by itself. A unit that was set up before is not visible unless its setup window is open.
4. **Wi-Fi:** choose the site's network, type the password, join. The unit remembers up to three networks.
5. **Checks:** run the connection checks and the speed test; fix anything shown in red (no internet, no clock) before you go on.
6. **Finish setup.** The unit restarts, joins the Wi-Fi and connects to WayTara. The device shows **online** in the dashboard within a few minutes, and the first readings appear after the next quarter hour.

## If something goes wrong
| What you see | What it means and what to do |
|---|---|
| The unit is not in Chrome's list | Its setup window is closed. A new unit opens it by itself. For one that was set up before, ask the office to open it. Do not hold buttons down. |
| "This unit is already linked to a different device" | A unit belongs to one device at a time. Ask an **admin** to press **Release unit** for the old device on the Device keys page, then finish setup again. |
| "The setup ticket was not accepted" | Go back one step and press Finish again: it makes a fresh single-use ticket. |
| Wi-Fi joins but the dashboard says offline | The site's internet may be down, or the Wi-Fi blocks the unit. Check the speed test step; try a phone hotspot to tell the two apart. |
| Dashboard says "the inverter is not answering" | The unit is online but the inverter does not reply: swap A and B, check the socket number (8), the inverter's Modbus ID (1) and that the inverter is on. |
| The Bluetooth link drops during setup | Normal after Finish (the unit restarts). Before that, stay within a few metres and keep the unit powered. |

## Good to know
* Setting up replaces any earlier setup of that unit: it gets a new key, and the old key stops working.
* The unit keeps its readings if the internet goes down and sends them when it is back. How long it can hold them has not been measured yet; after a long outage the oldest readings are dropped.
* Never post a unit's key or a charger's address in a chat or an email; they are shown once and can be replaced.
