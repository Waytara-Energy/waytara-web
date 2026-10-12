import { Cloud, CloudFog, CloudLightning, CloudMoon, CloudDrizzle, CloudRain, CloudRainWind, CloudSnow, CloudSun, Moon, Sun, type LucideIcon } from "lucide-react";
import type { Condition } from "@/lib/weather";
import type { SolarHour } from "@/lib/sun";
import { cn } from "@/lib/utils";

/** The icon (day and night) and colour of each kind of weather. */
export const WEATHER_ICON: Record<Condition, { day: LucideIcon; night: LucideIcon; tone: string }> = {
  clear: { day: Sun, night: Moon, tone: "text-amber-500" },
  fair: { day: CloudSun, night: CloudMoon, tone: "text-amber-500" },
  partly: { day: CloudSun, night: CloudMoon, tone: "text-amber-500" },
  cloudy: { day: Cloud, night: Cloud, tone: "text-slate-400" },
  fog: { day: CloudFog, night: CloudFog, tone: "text-slate-400" },
  drizzle: { day: CloudDrizzle, night: CloudDrizzle, tone: "text-sky-500" },
  rain: { day: CloudRain, night: CloudRain, tone: "text-sky-500" },
  heavyrain: { day: CloudRainWind, night: CloudRainWind, tone: "text-blue-600" },
  sleet: { day: CloudSnow, night: CloudSnow, tone: "text-sky-400" },
  snow: { day: CloudSnow, night: CloudSnow, tone: "text-sky-300" },
  thunder: { day: CloudLightning, night: CloudLightning, tone: "text-violet-500" },
};

export const temp = (v: number | null) => (v === null ? "·" : `${Math.round(v)}°`);
export const dayName = (date: string, i: number) => (i === 0 ? "Today" : i === 1 ? "Tomorrow" : new Date(`${date}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" }));
export const dayDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
/** A moment as a clock time in India ("6:02 am"). */
export const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
export const hourText = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "am" : "pm"}`;

/** The strongest sunshine the bars are drawn against, W/m² (a clear sky with the sun overhead). */
const FULL_SUN_WM2 = 1100;

/** Sunshine strength hour by hour: each bar is what the cloud leaves, over a faded bar for a clear sky. `now` marks the current hour. */
export function SolarBars({ hours, peakHour, nowHour, tall = false }: { hours: SolarHour[]; peakHour: number | null; nowHour?: number; tall?: boolean }) {
  if (hours.length === 0) return null;
  return (
    <div>
      <div className={cn("flex items-end gap-1", tall ? "h-36" : "h-28")} role="img" aria-label="Expected sunshine strength by hour">
        {hours.map((h) => (
          <div key={h.hour} className="flex h-full flex-1 flex-col justify-end" title={`${hourText(h.hour)}: about ${h.wm2} W/m² (${h.cloudPct}% cloud; ${h.clearWm2} W/m² with a clear sky)`}>
            <div className="relative w-full rounded-t-sm bg-muted/60" style={{ height: `${Math.max(2, (h.clearWm2 / FULL_SUN_WM2) * 100)}%` }}>
              <div className={cn("absolute inset-x-0 bottom-0 rounded-t-sm bg-amber-400", h.hour === nowHour && "bg-amber-500 ring-2 ring-amber-500/40")} style={{ height: `${h.clearWm2 > 0 ? (h.wm2 / h.clearWm2) * 100 : 0}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{hourText(hours[0].hour)}</span>
        <span>{peakHour !== null ? hourText(peakHour) : ""}</span>
        <span>{hourText(hours[hours.length - 1].hour + 1)}</span>
      </div>
    </div>
  );
}
