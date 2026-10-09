/**
 * Deye fault-code lookup — decodes `active_fault_code` (a device_readings
 * instrument, 0 = none) into a human-readable message and next step,
 * mirroring the read-register manual's own fault table. Kept in code, not
 * a DB table, same reasoning as instrument-settings-catalog.ts: this is
 * fixed domain knowledge about one inverter family, not customer data.
 *
 * The names follow the manufacturer's own fault table (the same list the
 * `fault_code` enum holds); each code has what it means and what the
 * customer can safely try. A code outside the table still renders a
 * generic-but-honest message via `getFaultInfo`'s fallback rather than a
 * raw number with no context.
 */

export interface FaultInfo {
  code: string;
  label: string;
  description: string;
  /** All the steps in one paragraph (for banners and notifications). */
  solution: string;
  /** The same steps one by one (for the troubleshooting guide). */
  steps: string[];
  /** Where the problem sits, for grouping in the guide. */
  group: "inverter" | "battery" | "grid";
  severity: "warning" | "critical";
}

const FAULT_TABLE: Record<number, FaultInfo> = {
  7: {
    code: "F07",
    label: "DC/DC soft-start fault",
    group: "inverter",
    description: "The inverter's internal power stage failed while starting up.",
    steps: ["Switch the inverter off at its DC and AC switches, wait one minute, then switch it back on.", "If the fault returns, stop using the system and contact your WayTara advisor."],
    solution: "Switch the inverter off at its DC and AC switches, wait one minute, then switch it back on. If the fault returns, stop using the system and contact your WayTara advisor.",
    severity: "critical",
  },
  10: {
    code: "F10",
    label: "Auxiliary power supply failure",
    group: "inverter",
    description: "The inverter's own control power supply is not working properly.",
    steps: ["Switch the inverter off at its DC and AC switches, wait one minute, then switch it back on.", "If the fault returns, stop using the system and contact your WayTara advisor."],
    solution: "Switch the inverter off at its DC and AC switches, wait one minute, then switch it back on. If the fault returns, stop using the system and contact your WayTara advisor.",
    severity: "critical",
  },
  13: {
    code: "F13",
    label: "Working mode changed",
    group: "inverter",
    description: "The inverter changed its working mode, for example after the grid type, frequency or battery mode was changed.",
    steps: ["This normally clears by itself within a few minutes.", "Switch the inverter off at its DC and AC switches, wait one minute, then switch it back on.", "If it comes back, contact your WayTara advisor."],
    solution: "This normally clears by itself within a few minutes. Switch the inverter off at its DC and AC switches, wait one minute, then switch it back on. If it comes back, contact your WayTara advisor.",
    severity: "warning",
  },
  17: {
    code: "F17",
    label: "Active battery hold",
    group: "battery",
    description: "The inverter is holding the battery connection while it checks it.",
    steps: ["Wait a few minutes and see whether it clears.", "Switch the inverter off at its DC and AC switches, wait one minute, then switch it back on.", "If it comes back, contact your WayTara advisor."],
    solution: "Wait a few minutes and see whether it clears. Switch the inverter off at its DC and AC switches, wait one minute, then switch it back on. If it comes back, contact your WayTara advisor.",
    severity: "warning",
  },
  18: {
    code: "F18",
    label: "Hardware AC over-current",
    group: "inverter",
    description: "More current than the inverter can supply was drawn on the AC side.",
    steps: ["Check that the total load on the backup and normal outputs is within the inverter's rating, and switch off the heaviest appliances.", "Restart the inverter, then switch the loads back on one by one.", "If it comes back, contact your WayTara advisor."],
    solution: "Check that the total load on the backup and normal outputs is within the inverter's rating, and switch off the heaviest appliances. Restart the inverter, then switch the loads back on one by one. If it comes back, contact your WayTara advisor.",
    severity: "critical",
  },
  20: {
    code: "F20",
    label: "Hardware DC over-current",
    group: "inverter",
    description: "Too much current on the solar or battery side. Starting a very large load while running without the grid can cause it.",
    steps: ["Check the solar panel and battery connections.", "Reduce the load on the inverter, then switch the inverter off at its DC and AC switches, wait one minute, then switch it back on.", "If it comes back, contact your WayTara advisor."],
    solution: "Check the solar panel and battery connections. Reduce the load on the inverter, then switch the inverter off at its DC and AC switches, wait one minute, then switch it back on. If it comes back, contact your WayTara advisor.",
    severity: "critical",
  },
  22: {
    code: "F22",
    label: "Emergency stop (inverter locked)",
    group: "inverter",
    description: "The inverter was stopped remotely.",
    steps: ["This is normally done by your installer or WayTara for service.", "If you did not expect it, contact your WayTara advisor."],
    solution: "This is normally done by your installer or WayTara for service. If you did not expect it, contact your WayTara advisor.",
    severity: "warning",
  },
  23: {
    code: "F23",
    label: "Transient AC leakage over-current",
    group: "inverter",
    description: "A brief leakage current was detected, often from wet or poorly earthed solar panels or cables.",
    steps: ["Check that the panels and cables are earthed and dry.", "Restart the inverter two or three times.", "If it keeps happening, stop using the system and contact your WayTara advisor."],
    solution: "Check that the panels and cables are earthed and dry. Restart the inverter two or three times. If it keeps happening, stop using the system and contact your WayTara advisor.",
    severity: "critical",
  },
  24: {
    code: "F24",
    label: "PV insulation resistance too low",
    group: "inverter",
    description: "The solar panel wiring is leaking to earth, often from damp, damaged cable or a loose connector.",
    steps: ["Do not touch the panel wiring.", "Check that the panel connectors are tight and dry, and the inverter's earth cable is connected.", "If it continues, contact your WayTara advisor to inspect the wiring."],
    solution: "Do not touch the panel wiring. Check that the panel connectors are tight and dry, and the inverter's earth cable is connected. If it continues, contact your WayTara advisor to inspect the wiring.",
    severity: "critical",
  },
  25: {
    code: "F25",
    label: "AC active battery fault",
    group: "battery",
    description: "The battery connection was interrupted on the AC side.",
    steps: ["Check the battery's cables and switch.", "Switch the inverter off at its DC and AC switches, wait one minute, then switch it back on.", "If it comes back, contact your WayTara advisor."],
    solution: "Check the battery's cables and switch. Switch the inverter off at its DC and AC switches, wait one minute, then switch it back on. If it comes back, contact your WayTara advisor.",
    severity: "warning",
  },
  26: {
    code: "F26",
    label: "DC bus unbalanced",
    group: "inverter",
    description: "The inverter's internal DC voltage is uneven, often when the load on the two output lines differs a lot.",
    steps: ["Wait a few minutes and see whether it clears.", "Balance the load between the two output lines if you can.", "Switch the inverter off at its DC and AC switches, wait one minute, then switch it back on."],
    solution: "Wait a few minutes and see whether it clears. Balance the load between the two output lines if you can. Switch the inverter off at its DC and AC switches, wait one minute, then switch it back on.",
    severity: "warning",
  },
  29: {
    code: "F29",
    label: "Parallel CAN bus fault",
    group: "inverter",
    description: "Inverters working together lost their link to each other.",
    steps: ["Check the communication cable between the inverters.", "During start-up of a multi-inverter system this clears once every inverter is on.", "If it comes back, contact your WayTara advisor."],
    solution: "Check the communication cable between the inverters. During start-up of a multi-inverter system this clears once every inverter is on. If it comes back, contact your WayTara advisor.",
    severity: "warning",
  },
  31: {
    code: "F31",
    label: "Soft start failed",
    group: "inverter",
    description: "The inverter could not start up smoothly.",
    steps: ["Switch the inverter off at its DC and AC switches, wait one minute, then switch it back on.", "If it comes back, contact your WayTara advisor."],
    solution: "Switch the inverter off at its DC and AC switches, wait one minute, then switch it back on. If it comes back, contact your WayTara advisor.",
    severity: "warning",
  },
  35: {
    code: "F35",
    label: "No AC grid",
    group: "grid",
    description: "The inverter cannot see grid power.",
    steps: ["Check whether there is a power cut in your area.", "Check that the grid breaker or switch to the inverter is on.", "If the grid is fine and the fault stays, contact your WayTara advisor."],
    solution: "Check whether there is a power cut in your area. Check that the grid breaker or switch to the inverter is on. If the grid is fine and the fault stays, contact your WayTara advisor.",
    severity: "warning",
  },
  37: {
    code: "F37",
    label: "DC LLC software over-current",
    group: "inverter",
    description: "The battery-side power stage detected too much current.",
    steps: ["Switch the inverter off at its DC and AC switches, wait one minute, then switch it back on.", "If the fault returns, contact your WayTara advisor."],
    solution: "Switch the inverter off at its DC and AC switches, wait one minute, then switch it back on. If the fault returns, contact your WayTara advisor.",
    severity: "critical",
  },
  39: {
    code: "F39",
    label: "DC LLC over-current",
    group: "inverter",
    description: "The battery-side power stage detected too much current.",
    steps: ["Switch the inverter off at its DC and AC switches, wait one minute, then switch it back on.", "If the fault returns, contact your WayTara advisor."],
    solution: "Switch the inverter off at its DC and AC switches, wait one minute, then switch it back on. If the fault returns, contact your WayTara advisor.",
    severity: "critical",
  },
  40: {
    code: "F40",
    label: "Battery over-current",
    group: "battery",
    description: "The battery is charging or discharging with more current than it allows.",
    steps: ["Reduce the load and check that the battery settings match your battery.", "Switch the inverter off at its DC and AC switches, wait one minute, then switch it back on.", "If it continues, contact your WayTara advisor."],
    solution: "Reduce the load and check that the battery settings match your battery. Switch the inverter off at its DC and AC switches, wait one minute, then switch it back on. If it continues, contact your WayTara advisor.",
    severity: "critical",
  },
  41: {
    code: "F41",
    label: "Parallel system stop (another unit faulted)",
    group: "inverter",
    description: "Another inverter in a multi-inverter system is off or faulted.",
    steps: ["Check the other inverters and clear their faults first."],
    solution: "Check the other inverters and clear their faults first.",
    severity: "warning",
  },
  42: {
    code: "F42",
    label: "AC line voltage too low",
    group: "grid",
    description: "Grid voltage fell below the safe range.",
    steps: ["This usually clears when the grid recovers.", "Check that the AC cables to the inverter are firmly connected.", "If it happens often, ask your WayTara advisor to check your grid connection."],
    solution: "This usually clears when the grid recovers. Check that the AC cables to the inverter are firmly connected. If it happens often, ask your WayTara advisor to check your grid connection.",
    severity: "warning",
  },
  46: {
    code: "F46",
    label: "Backup battery fault",
    group: "battery",
    description: "The inverter reports a problem with the backup battery.",
    steps: ["Check the battery's switch and cables.", "Switch the inverter off at its DC and AC switches, wait one minute, then switch it back on.", "If it comes back, contact your WayTara advisor."],
    solution: "Check the battery's switch and cables. Switch the inverter off at its DC and AC switches, wait one minute, then switch it back on. If it comes back, contact your WayTara advisor.",
    severity: "warning",
  },
  47: {
    code: "F47",
    label: "AC over-frequency",
    group: "grid",
    description: "Grid frequency rose above the safe range.",
    steps: ["This usually clears when the grid recovers.", "If it happens often, ask your WayTara advisor to check your grid connection."],
    solution: "This usually clears when the grid recovers. If it happens often, ask your WayTara advisor to check your grid connection.",
    severity: "warning",
  },
  48: {
    code: "F48",
    label: "AC under-frequency",
    group: "grid",
    description: "Grid frequency fell below the safe range.",
    steps: ["This usually clears when the grid recovers.", "If it happens often, ask your WayTara advisor to check your grid connection."],
    solution: "This usually clears when the grid recovers. If it happens often, ask your WayTara advisor to check your grid connection.",
    severity: "warning",
  },
  49: {
    code: "F49",
    label: "Backup battery fault",
    group: "battery",
    description: "The inverter reports a problem with the backup battery.",
    steps: ["Check the battery's switch and cables.", "Switch the inverter off at its DC and AC switches, wait one minute, then switch it back on.", "If it comes back, contact your WayTara advisor."],
    solution: "Check the battery's switch and cables. Switch the inverter off at its DC and AC switches, wait one minute, then switch it back on. If it comes back, contact your WayTara advisor.",
    severity: "warning",
  },
  56: {
    code: "F56",
    label: "DC bus voltage too low (battery low)",
    group: "battery",
    description: "The battery voltage is too low for the inverter to run from it.",
    steps: ["Let solar or the grid charge the battery, and avoid heavy loads until it recovers.", "If it does not recover, contact your WayTara advisor."],
    solution: "Let solar or the grid charge the battery, and avoid heavy loads until it recovers. If it does not recover, contact your WayTara advisor.",
    severity: "warning",
  },
  58: {
    code: "F58",
    label: "BMS communication fault",
    group: "battery",
    description: "The inverter lost its data link to the battery's management system.",
    steps: ["Check that the communication cable between the battery and the inverter is firmly plugged in at both ends.", "Check that the battery is switched on.", "Switch the inverter off at its DC and AC switches, wait one minute, then switch it back on.", "If it continues, contact your WayTara advisor."],
    solution: "Check that the communication cable between the battery and the inverter is firmly plugged in at both ends. Check that the battery is switched on. Switch the inverter off at its DC and AC switches, wait one minute, then switch it back on. If it continues, contact your WayTara advisor.",
    severity: "critical",
  },
  60: {
    code: "F60",
    label: "Generator voltage or frequency fault",
    group: "grid",
    description: "The generator's power is outside the range the inverter accepts.",
    steps: ["Check the generator's output and settings.", "If it comes back, contact your WayTara advisor."],
    solution: "Check the generator's output and settings. If it comes back, contact your WayTara advisor.",
    severity: "warning",
  },
  61: {
    code: "F61",
    label: "Manually turned off by button",
    group: "inverter",
    description: "The inverter was switched off with its button.",
    steps: ["Switch it back on with the button on the inverter, or contact your WayTara advisor."],
    solution: "Switch it back on with the button on the inverter, or contact your WayTara advisor.",
    severity: "warning",
  },
  63: {
    code: "F63",
    label: "Arc fault (US only)",
    group: "inverter",
    description: "An electrical arc was detected on the solar wiring (a feature of US-market inverters).",
    steps: ["Do not touch the panel wiring.", "Contact your WayTara advisor to inspect the solar cable connections."],
    solution: "Do not touch the panel wiring. Contact your WayTara advisor to inspect the solar cable connections.",
    severity: "critical",
  },
  64: {
    code: "F64",
    label: "Heat sink over-temperature",
    group: "inverter",
    description: "The inverter's heat sink is too hot.",
    steps: ["Make sure the inverter's vents are clear and it is not in direct sun.", "Switch it off for ten minutes to cool down, then restart.", "If it keeps overheating, contact your WayTara advisor."],
    solution: "Make sure the inverter's vents are clear and it is not in direct sun. Switch it off for ten minutes to cool down, then restart. If it keeps overheating, contact your WayTara advisor.",
    severity: "critical",
  },
};

/** Every fault in the table, by code, for the troubleshooting guide. */
export const FAULT_LIST: FaultInfo[] = Object.entries(FAULT_TABLE).sort(([a], [b]) => Number(a) - Number(b)).map(([, v]) => v);

/** Never returns null for a non-zero code — an unmapped code still gets an
 *  honest, generic message rather than being silently dropped. */
export function getFaultInfo(code: number): FaultInfo | null {
  if (!code) return null;
  return (
    FAULT_TABLE[code] ?? {
      code: `F${code}`,
      label: `Fault F${code}`,
      description: "The inverter is reporting a fault code not yet in WayTara's lookup table.",
      solution: "Contact WayTara support with this code so we can look into it.",
      steps: ["Contact WayTara support with this code so we can look into it."],
      group: "inverter",
      severity: "warning",
    }
  );
}

export interface FaultEvent {
  code: number;
  info: FaultInfo;
  startedAt: string;
  /** null = still active as of the most recent reading in the window. */
  resolvedAt: string | null;
}

/**
 * Collapses a raw, noisy `active_fault_code` reading series (the
 * ingestion script may re-report the same active fault every poll) into
 * discrete fault *episodes* — one row per continuous run of the same
 * non-zero code, not one row per reading. Readings must be ascending by
 * `ts`; a fault "resolves" whenever the code changes to anything else
 * (0 or a different fault), timestamped at that next reading.
 */
export function deriveFaultEvents(readings: { value: number | null; ts: string }[]): FaultEvent[] {
  const events: FaultEvent[] = [];
  let open: FaultEvent | null = null;

  for (const r of readings) {
    const code = r.value ?? 0;
    if (open && code !== open.code) {
      open.resolvedAt = r.ts;
      open = null;
    }
    if (!open && code !== 0) {
      const info = getFaultInfo(code);
      if (info) {
        open = { code, info, startedAt: r.ts, resolvedAt: null };
        events.push(open);
      }
    }
  }

  return events.reverse(); // most recent first
}
