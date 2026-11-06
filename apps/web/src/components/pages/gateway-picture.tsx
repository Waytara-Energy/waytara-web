import Image from "next/image";
import { BatteryCharging, Cpu, EvCharger, Fuel, Gauge, Sun, Zap, type LucideIcon } from "lucide-react";

/**
 * The gateway picture with the equipment drawn on its pads: solar, inverter, battery, EV charger, generator and meter around, and the gateway chip in the
 * middle. The icons are the ones the dashboard already uses (Sun, Zap, BatteryCharging, EvCharger, Fuel, Gauge, Cpu). They sit over the two pictures,
 * placed by percentages of the picture and sized in container units, so they stay on their pads at every width and follow the theme.
 */
const PADS: { icon: LucideIcon; label: string; x: number; y: number; size: number }[] = [
  { icon: Sun, label: "Solar", x: 19.6, y: 23.4, size: 4.6 },
  { icon: Zap, label: "Inverter", x: 14.6, y: 64.7, size: 4.6 },
  { icon: BatteryCharging, label: "Battery", x: 80.4, y: 23.4, size: 4.6 },
  { icon: EvCharger, label: "EV charger", x: 85.4, y: 64.7, size: 4.6 },
  { icon: Fuel, label: "Generator", x: 9.0, y: 42.3, size: 2.8 },
  { icon: Gauge, label: "Meter", x: 91.3, y: 42.2, size: 2.8 },
];

export function GatewayPicture() {
  return (
    <div
      role="img"
      aria-label="The WayTara gateway in the middle, connected to solar, an inverter, a battery, an EV charger, a generator and a meter."
      className="overflow-hidden rounded-3xl bg-theme-surface [container-type:inline-size]"
    >
      <div className="relative aspect-[2752/1536]">
        <Image src="/images/platform/gateway-light.webp" alt="" fill sizes="(min-width: 1280px) 1300px, 100vw" className="object-cover dark:hidden" />
        <Image src="/images/platform/gateway-dark.webp" alt="" fill sizes="(min-width: 1280px) 1300px, 100vw" className="hidden object-cover dark:block" />

        {PADS.map(({ icon: Icon, label, x, y, size }) => (
          <span
            key={label}
            aria-hidden="true"
            className="absolute -translate-x-1/2 -translate-y-1/2 text-emerald-600 drop-shadow-[0_1px_1px_rgba(255,255,255,0.6)] dark:text-emerald-400 dark:drop-shadow-[0_0_6px_rgba(52,211,153,0.45)]"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <Icon style={{ width: `${size}cqw`, height: `${size}cqw` }} strokeWidth={1.4} />
          </span>
        ))}

        {/* The gateway itself, on the chip in the middle. */}
        <span
          aria-hidden="true"
          className="absolute -translate-x-1/2 -translate-y-1/2 text-theme-primary drop-shadow-[0_1px_1px_rgba(255,255,255,0.6)] dark:drop-shadow-[0_0_10px_rgba(52,211,153,0.35)]"
          style={{ left: "50.2%", top: "48.8%" }}
        >
          <Cpu style={{ width: "11cqw", height: "11cqw" }} strokeWidth={1} />
        </span>
      </div>
    </div>
  );
}
