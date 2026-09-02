/**
 * Deye fault-code lookup — decodes `active_fault_code` (a device_readings
 * instrument, 0 = none) into a human-readable message and next step,
 * mirroring the read-register manual's own fault table. Kept in code, not
 * a DB table, same reasoning as instrument-settings-catalog.ts: this is
 * fixed domain knowledge about one inverter family, not customer data.
 *
 * Only the codes actually named in the manual excerpt are mapped in
 * detail (F13/F18/F20/F63/F64); any other non-zero code still renders a
 * generic-but-honest message via `getFaultInfo`'s fallback rather than a
 * raw number with no context.
 */

export interface FaultInfo {
  code: string;
  label: string;
  description: string;
  solution: string;
  severity: "warning" | "critical";
}

const FAULT_TABLE: Record<number, FaultInfo> = {
  13: {
    code: "F13",
    label: "Grid Under Voltage",
    description: "The grid voltage measured at the inverter's AC input dropped below the safe operating range.",
    solution: "Usually resolves on its own once grid voltage stabilizes. If it repeats often, ask your WayTara advisor to check the site's grid connection quality.",
    severity: "warning",
  },
  18: {
    code: "F18",
    label: "Grid Over Frequency",
    description: "The grid frequency measured at the inverter's AC input rose above the safe operating range.",
    solution: "Usually resolves on its own once grid frequency stabilizes. Report it if it happens repeatedly.",
    severity: "warning",
  },
  20: {
    code: "F20",
    label: "DC Injection High",
    description: "The inverter detected excess DC current being injected into the AC grid connection.",
    solution: "Stop using the system and contact WayTara support — this needs a technician visit.",
    severity: "critical",
  },
  63: {
    code: "F63",
    label: "Battery Communication Fault",
    description: "The inverter lost communication with the battery's BMS.",
    solution: "Check the battery's BMS connection cable. If it persists, contact WayTara support.",
    severity: "critical",
  },
  64: {
    code: "F64",
    label: "Battery Over Temperature",
    description: "The battery's reported temperature exceeded its safe operating range.",
    solution: "Ensure the battery has ventilation and isn't in direct sun. Contact WayTara support if the temperature doesn't come back down.",
    severity: "critical",
  },
};

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
