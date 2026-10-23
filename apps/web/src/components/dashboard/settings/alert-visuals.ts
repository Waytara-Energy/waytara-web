import { Activity, ArrowDownToLine, ArrowUpFromLine, BatteryCharging, BatteryFull, BatteryLow, BatteryMedium, CloudSun, Gauge, House, PiggyBank, PlugZap, Receipt, Sun, Tag, Thermometer, Zap, type LucideIcon } from "lucide-react";
import type { Op } from "@/lib/alert-rules";

// How an alert looks in the list: a coloured tile with a white icon, like the shortcuts of a phone. Each thing that can be watched has its
// own colour and icon; the full class names are written out so the styles are generated.

export interface AlertLook {
  icon: LucideIcon;
  /** the gradient of the tile */
  gradient: string;
}

const LOOKS: Record<string, AlertLook> = {
  battery_soc: { icon: BatteryMedium, gradient: "from-emerald-400 to-green-600" },
  battery_charge_kw: { icon: BatteryCharging, gradient: "from-teal-400 to-emerald-600" },
  battery_discharge_kw: { icon: Zap, gradient: "from-lime-400 to-green-600" },
  battery_temp_c: { icon: Thermometer, gradient: "from-orange-400 to-red-500" },
  solar_kw: { icon: Sun, gradient: "from-amber-300 to-orange-500" },
  solar_today_kwh: { icon: CloudSun, gradient: "from-yellow-300 to-amber-500" },
  grid_import_kw: { icon: ArrowDownToLine, gradient: "from-sky-400 to-blue-600" },
  grid_export_kw: { icon: ArrowUpFromLine, gradient: "from-cyan-400 to-sky-600" },
  import_today_kwh: { icon: PlugZap, gradient: "from-indigo-400 to-blue-700" },
  export_today_kwh: { icon: ArrowUpFromLine, gradient: "from-sky-300 to-cyan-600" },
  load_kw: { icon: Gauge, gradient: "from-violet-400 to-purple-600" },
  load_today_kwh: { icon: House, gradient: "from-fuchsia-400 to-purple-700" },
  tariff_rate: { icon: Tag, gradient: "from-pink-400 to-rose-600" },
  import_cost_today: { icon: Receipt, gradient: "from-rose-400 to-red-600" },
  solar_value_today: { icon: PiggyBank, gradient: "from-emerald-300 to-teal-600" },
};
const FALLBACK: AlertLook = { icon: Activity, gradient: "from-slate-400 to-slate-600" };

/** The tile of an alert on this metric. The battery level changes its icon with the direction (a low-battery alert shows a low battery). */
export function alertLook(metric: string, op: Op): AlertLook {
  const look = LOOKS[metric] ?? FALLBACK;
  if (metric === "battery_soc") return { ...look, icon: op === "below" ? BatteryLow : BatteryFull };
  return look;
}
