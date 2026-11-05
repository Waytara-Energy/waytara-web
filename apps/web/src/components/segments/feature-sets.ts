import { Activity, BellRing, ClipboardList, Handshake, History, LifeBuoy, ListChecks, LockOpen, Share2, SlidersHorizontal, Zap } from "lucide-react";
import { DASHBOARD_FEATURES } from "@/components/sections/dashboard-key-features";
import { CPMS_FEATURES } from "./capabilities";
import type { Feature } from "./segment-parts";

/** What WayTara's charge-point management (CPMS) does today, as shown on the EV Fleets page. */
export const CPMS_TILES: Feature[] = [
  { icon: Activity, title: "Charger status", body: "Monitor your connected chargers: whether each is available or in use, and its operating status." },
  { icon: SlidersHorizontal, title: "Remote control", body: "Read charger information and start or stop a charging session remotely, on chargers that support it." },
  { icon: ClipboardList, title: "Charging records", body: "Understand how much each charger is used with session and energy records for every charger." },
  { icon: ListChecks, title: "Know your chargers", body: "See which OCPP features each charger offers, including smart-charging limits, before you plan around them." },
  ...(CPMS_FEATURES.monetisation
    ? [{ icon: Handshake, title: "Paid charging", body: "Set up users, access and payment for commercial charging." }]
    : []),
];

/**
 * Everything energy management (EMS) does for supported equipment, as one list for the Platform page: the dashboard's features, without the
 * charger control (that is listed under charger management), plus the history, alerts, inverter settings and engineer help that are part of it.
 */
export const EMS_PLATFORM_FEATURES: Feature[] = [
  DASHBOARD_FEATURES[0], // Live, as it happens
  DASHBOARD_FEATURES[1], // Every site, one login
  { icon: History, title: "History for every device", body: "Daily, monthly and yearly history for each connected device, so you can see how it has behaved over time." },
  { icon: BellRing, title: "Alerts when a device goes quiet", body: "Online and offline status for every device, with an e-mail alert when one goes quiet so you can act on it." },
  DASHBOARD_FEATURES[2], // Savings from your real tariff
  DASHBOARD_FEATURES[3], // Reports that arrive by themselves
  DASHBOARD_FEATURES[4], // Reports that show their sources
  DASHBOARD_FEATURES[5], // Schedule your power
  { icon: SlidersHorizontal, title: "Change inverter settings", body: "Change selected inverter settings from the dashboard. Each change is confirmed by reading the value back from the inverter." },
  DASHBOARD_FEATURES[6], // Weather built in
  DASHBOARD_FEATURES[8], // Charts that tell the truth
  { icon: LifeBuoy, title: "Help from your engineer", body: "Ask your engineer for help through support tickets in the same app, with an e-mail each time someone replies." },
];

/** Everything charger management (CPMS) does for compatible OCPP chargers, as one list for the Platform page. */
export const CPMS_PLATFORM_FEATURES: Feature[] = [
  CPMS_TILES[0], // Charger status
  { icon: Zap, title: "Live charging sessions", body: "Live power and energy for a running session, so you can follow every charge as it happens." },
  CPMS_TILES[2], // Charging records
  CPMS_TILES[1], // Remote control
  { icon: LockOpen, title: "Reset and unlock", body: "Reset a charger or unlock a connector from the dashboard, on chargers that support the command." },
  CPMS_TILES[3], // Know your chargers
  ...(CPMS_FEATURES.monetisation
    ? [{ icon: Handshake, title: "Paid charging", body: "Run charging as a commercial service, with users, access and paid charging." }]
    : []),
  ...(CPMS_FEATURES.loadAllocation
    ? [{ icon: Share2, title: "Share site capacity", body: "Apply charging limits to compatible chargers to share the site's capacity." }]
    : []),
];
