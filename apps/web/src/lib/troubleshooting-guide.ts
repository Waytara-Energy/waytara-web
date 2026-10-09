// The Maintenance page's troubleshooting guide: what each fault code, warning, charger error and indicator light means, and what a
// customer can safely try. The inverter faults come from the one fault table (deye-fault-codes.ts); the rest is written here. Pure data,
// so the page and its tests share it. Steps never ask a customer to open equipment or touch wiring.

import { FAULT_LIST } from "./deye-fault-codes";

export interface GuideItem {
  /** What the device reports (F58, W03, GroundFailure), used to mark the one that is active. Lights have none. */
  code: string | null;
  label: string;
  what: string;
  steps: string[];
  severity: "info" | "warning" | "critical";
}

export interface GuideSection {
  id: string;
  title: string;
  note?: string;
  items: GuideItem[];
}

const CALL = "If it keeps happening, contact your WayTara advisor.";

const faultItems = (group: "inverter" | "battery" | "grid"): GuideItem[] =>
  FAULT_LIST.filter((f) => f.group === group).map((f) => ({ code: f.code, label: f.label, what: f.description, steps: f.steps, severity: f.severity }));

/** A solar inverter: its faults grouped by where the problem sits, the warnings, and what the indicator lights mean. */
export function inverterGuide(): GuideSection[] {
  return [
    { id: "inverter-faults", title: "Inverter faults", note: "A fault stops or limits the inverter. The code is shown on the inverter's screen and in the Health tab.", items: faultItems("inverter") },
    {
      id: "battery-faults",
      title: "Battery",
      items: [
        ...faultItems("battery"),
        {
          code: null,
          label: "Battery alarm or fault",
          what: "The battery's own protection has raised an alarm or fault.",
          steps: ["Check that the battery is switched on and its cables are firm.", "Keep it ventilated and out of direct sun.", CALL],
          severity: "warning",
        },
      ],
    },
    { id: "grid-faults", title: "Grid and wiring", items: faultItems("grid") },
    {
      id: "warnings",
      title: "Warnings",
      note: "A warning does not stop the inverter, but it should not be ignored.",
      items: [
        { code: "W02", label: "Fan warning", what: "The inverter's cooling fan is not running as expected.", steps: ["Make sure nothing blocks the vents or fan.", CALL], severity: "warning" },
        { code: "W03", label: "Grid phase wrong", what: "The grid wires may be connected in the wrong order.", steps: ["Ask an electrician or your WayTara advisor to check the grid connection."], severity: "warning" },
        { code: "W04", label: "Meter communication failure", what: "The inverter cannot read the energy meter.", steps: ["Ask your WayTara advisor to check the meter cable.", "Your solar still runs, but export limiting and some readings may be off."], severity: "warning" },
      ],
    },
    {
      id: "lights",
      title: "Indicator lights",
      note: "The names can differ slightly between models. If your inverter's lights do not match, use its manual.",
      items: [
        { code: null, label: "DC light (green)", what: "On: the solar input is connected and normal.", steps: ["Off at night is normal.", "Off in daylight: check that the solar switch is on, then contact your advisor."], severity: "info" },
        { code: null, label: "AC light (green)", what: "On: the grid is connected and normal.", steps: ["Off: check whether there is a power cut, and that the grid breaker is on."], severity: "info" },
        { code: null, label: "Normal light (green)", what: "On: the inverter is working normally. Flashing: starting up or on standby.", steps: ["No action needed."], severity: "info" },
        { code: null, label: "Alarm light (red)", what: "On: a fault or alarm is active.", steps: ["Look at the Health tab for the code and its steps.", "Do not repeatedly switch the inverter off and on."], severity: "critical" },
      ],
    },
  ];
}

const charger = (code: string, label: string, what: string, steps: string[], severity: GuideItem["severity"] = "warning"): GuideItem => ({ code, label, what, steps, severity });

/** An EV charger: its error codes, what the connector status means, and the errors reported by the car. */
export function evChargerGuide(): GuideSection[] {
  return [
    {
      id: "charger-errors",
      title: "Charger errors",
      items: [
        charger("ConnectorLockFailure", "Connector lock failure", "The plug could not lock or unlock.", ["Unplug, then plug in again firmly.", "Check that nothing is stuck in the socket.", CALL]),
        charger("EVCommunicationError", "Car communication error", "The charger cannot talk to the car.", ["Unplug and plug in again.", "Try another cable if you have one.", CALL]),
        charger("GroundFailure", "Earth leakage fault", "The charger detected current leaking to earth and stopped for safety.", ["Do not use the charger if the cable or plug is wet or damaged.", "Reset the charger's breaker once.", "If it trips again, stop using it and contact your WayTara advisor."], "critical"),
        charger("HighTemperature", "High temperature", "The charger or its cable is too hot.", ["Let it cool down and keep it shaded and ventilated.", CALL]),
        charger("InternalError", "Internal error", "The charger had an internal problem.", ["Switch the charger off at its breaker for one minute, then on.", CALL]),
        charger("LocalListConflict", "Access list conflict", "The charger's list of allowed cards is out of step.", ["Contact your WayTara advisor to refresh it."]),
        charger("OtherError", "Other error", "The charger reported a problem that has no specific code.", ["Switch the charger off at its breaker for one minute, then on.", CALL]),
        charger("OverCurrentFailure", "Over-current", "More current than allowed was drawn.", ["Check the cable and plug for damage.", "Stop and start charging again.", CALL], "critical"),
        charger("OverVoltage", "Supply voltage too high", "The power supply to the charger is above the safe range.", ["This usually clears when the supply recovers.", CALL]),
        charger("UnderVoltage", "Supply voltage too low", "The power supply to the charger is below the safe range.", ["This usually clears when the supply recovers.", "Avoid running other heavy loads at the same time.", CALL]),
        charger("PowerMeterFailure", "Energy meter failure", "The charger's energy meter is not reading.", ["Switch the charger off at its breaker for one minute, then on.", CALL]),
        charger("PowerSwitchFailure", "Power switch (relay) failure", "The charger's internal switch did not work.", ["Stop using the charger and contact your WayTara advisor."], "critical"),
        charger("ReaderFailure", "Card reader failure", "The charger's card or tag reader is not working.", ["Try again, holding the card steady on the reader.", "Start the charge from the app instead if you can.", CALL]),
        charger("ResetFailure", "Reset failure", "The charger could not restart itself.", ["Switch the charger off at its breaker for one minute, then on.", CALL]),
        charger("WeakSignal", "Weak network signal", "The charger has a poor connection to the network.", ["Check your Wi-Fi or mobile signal near the charger.", "Charging may still work, but readings can be delayed."], "info"),
      ],
    },
    {
      id: "connector-status",
      title: "What the charger is doing",
      items: [
        charger("Available", "Available", "Ready, with no car plugged in.", ["Plug in your car to start."], "info"),
        charger("Preparing", "Preparing", "A car is plugged in and the charge is getting ready.", ["Wait a moment, or start the charge from the app or with your card."], "info"),
        charger("Charging", "Charging", "Energy is flowing into the car.", ["No action needed."], "info"),
        charger("SuspendedEV", "Paused by the car", "The car has paused the charge, for example because it is full or too hot.", ["Check the car's own charging settings."], "info"),
        charger("SuspendedEVSE", "Paused by the charger", "The charger has paused the charge, for example to share power with other loads.", ["Wait, or reduce other heavy loads."], "info"),
        charger("Finishing", "Finishing", "The charge has ended and the plug is about to be released.", ["Wait a moment, then unplug."], "info"),
        charger("Reserved", "Reserved", "The charger is held for a booking.", ["Use the booking, or ask your advisor to cancel it."], "info"),
        charger("Unavailable", "Unavailable", "The charger is switched off or out of service.", ["Check that it has power and is not in maintenance mode.", CALL], "warning"),
        charger("Faulted", "Faulted", "The charger has stopped because of an error.", ["Look at the error shown above and follow its steps."], "critical"),
      ],
    },
    {
      id: "car-errors",
      title: "Errors reported by the car",
      items: [
        charger("FAILED_ChargerConnectorLockFault", "Charger lock fault", "The car says the plug did not lock.", ["Unplug and plug in again firmly."]),
        charger("FAILED_ChargingCurrentdifferential", "Current mismatch", "The current the car asked for and the charger gave do not match.", ["Stop and restart the charge.", CALL]),
        charger("FAILED_ChargingSystemIncompatibility", "Car and charger not compatible", "The car and charger could not agree how to charge.", ["Try again with the cable that came with the car.", CALL]),
        charger("FAILED_ChargingVoltageOutOfRange", "Voltage out of range", "The charging voltage is outside what the car accepts.", ["Stop and restart the charge.", CALL]),
        charger("FAILED_EVRESSMalfunction", "Car battery system fault", "The car reports a problem with its own battery system.", ["Check the car's dashboard and its manual.", "Contact the car's service centre if it continues."]),
        charger("FAILED_EVShiftPosition", "Car not in park", "The car is not in park or the correct position to charge.", ["Put the car in park and switch it off."]),
        charger("FAILED_RESSTemperatureInhibit", "Car battery too hot or cold", "The car will not charge while its battery is outside its safe temperature range.", ["Wait until the car's battery returns to a normal temperature."], "info"),
      ],
    },
  ];
}

/** True when the item is the one the device is reporting now. */
export const isActiveItem = (item: GuideItem, active: readonly string[]): boolean => item.code !== null && active.includes(item.code);
