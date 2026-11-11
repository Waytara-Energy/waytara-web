import * as React from "react";
import { BatteryCharging, EvCharger, PlugZap, Router, SolarPanel } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";

// A solar inverter: a box with the AC wave on its display and the cables underneath (the icon set has none), drawn like the others (outline, round ends).
function InverterIcon({ className, strokeWidth = 1.6 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="4" y="3" width="16" height="14" rx="2" />
      <path d="M7 11q1.75-4 3.5 0t3.5 0t3.5 0" />
      <path d="M9 17v3M15 17v3" />
    </svg>
  );
}

// The equipment the platform brings together.
const EQUIPMENT: { icon: React.ElementType; label: string }[] = [
  { icon: SolarPanel, label: "Solar panels" },
  { icon: InverterIcon, label: "Solar inverters" },
  { icon: BatteryCharging, label: "Battery storage" },
  { icon: PlugZap, label: "Portable charger" },
  { icon: EvCharger, label: "Wall-mount charger" },
  { icon: Router, label: "WayTara gateway" },
];

/**
 * A row of icons with the names of what WayTara connects, between "Our approach" and "What WayTara does" on the landing page. Set out like the columns
 * of the sections around it: a thin outline icon, the name under it, left-aligned in even columns (six across on a wide screen, three across on a
 * tablet and on a phone).
 */
export function EquipmentStrip() {
  return (
    <section aria-label="What WayTara connects" className="relative z-10 bg-theme-bg py-4 sm:py-6">
      <div className="fluid-container">
        <Reveal direction="up" duration={800} distance={16}>
          <ul className="grid grid-cols-3 gap-x-3 gap-y-7 sm:gap-x-8 sm:gap-y-10 lg:grid-cols-6">
            {EQUIPMENT.map(({ icon: Icon, label }) => (
              <li key={label} className="flex flex-col items-start gap-3 sm:gap-3.5">
                <Icon aria-hidden="true" strokeWidth={1.4} className="size-8 shrink-0 text-theme-primary sm:size-10" />
                <span className="text-balance text-sm font-semibold leading-snug text-theme-primary sm:text-base">{label}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
