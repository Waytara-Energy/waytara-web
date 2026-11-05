import { Activity, CalendarClock, CloudSun, FileCheck2, Layers, MailCheck, PlugZap, ReceiptIndianRupee, SearchCheck } from "lucide-react";
import { FeatureColumns } from "@/components/segments/segment-parts";

// What the customer dashboard really does, each point checked against the product code: the live energy flow and Go Live, several sites with their own
// devices, savings worked out from the state tariff, reports e-mailed daily, weekly or monthly, reports that print their sources, the inverter's
// time-of-use schedule, the weather for each site, EV charger control, and charts that show a gap where a device was offline.
// Not claimed because they are not built: reports in a government format (BRSR, GHG), and any "first" or "only" wording (not verifiable).
export const DASHBOARD_FEATURES = [
  {
    icon: Activity,
    title: "Live, as it happens",
    body: "Solar, battery, load, grid and EV charging on one live energy-flow diagram, with Go Live to watch a device's readings as they arrive.",
  },
  {
    icon: Layers,
    title: "Every site, one login",
    body: "Switch between your sites. Each has its own devices (inverters, batteries, meters and chargers), each with its own tab.",
  },
  {
    icon: ReceiptIndianRupee,
    title: "Savings from your real tariff",
    body: "Your bill is worked out month by month the way your electricity board does it: bands, free units and duty, not one flat rate.",
  },
  {
    icon: MailCheck,
    title: "Reports that arrive by themselves",
    body: "Build a report once and have it e-mailed daily, weekly or monthly, or download it whenever you need it from the dashboard.",
  },
  {
    icon: FileCheck2,
    title: "Reports that show their sources",
    body: "Every report prints the figures it used, such as the grid emission factor and where it comes from, so you can stand behind the numbers.",
  },
  {
    icon: CalendarClock,
    title: "Schedule your power",
    body: "See and set your inverter's time-of-use schedule by weekday and time slot. A change shows as pending until the inverter confirms it.",
  },
  {
    icon: CloudSun,
    title: "Weather built in",
    body: "Current conditions and the days ahead for each of your sites, right next to what your solar is producing there.",
  },
  {
    icon: PlugZap,
    title: "Run your EV charging",
    body: "Start or stop a supported charger and follow every charging session as it happens, from the same app as your solar.",
  },
  {
    icon: SearchCheck,
    title: "Charts that tell the truth",
    body: "When a device was offline, the chart shows a clear gap instead of a made-up line, so you can trust what you are looking at.",
  },
];

/** The key features of the software: the same frameless blocks as the rest of the site, three to a row. */
export function DashboardKeyFeatures() {
  return (
    <div className="fluid-container">
      <FeatureColumns items={DASHBOARD_FEATURES} columns={3} />
    </div>
  );
}
