import { Activity, ClipboardList, Handshake, ListChecks, SlidersHorizontal } from "lucide-react";
import { CPMS_FEATURES } from "./capabilities";
import type { Feature } from "./segment-parts";

/** What WayTara's charge-point management (CPMS) does today, shared by the EV Fleets page and the Platform page. */
export const CPMS_TILES: Feature[] = [
  { icon: Activity, title: "Charger status", body: "Monitor your connected chargers: whether each is available or in use, and its operating status." },
  { icon: SlidersHorizontal, title: "Remote control", body: "Read charger information and start or stop a charging session remotely, on chargers that support it." },
  { icon: ClipboardList, title: "Charging records", body: "Understand how much each charger is used with session and energy records for every charger." },
  { icon: ListChecks, title: "Know your chargers", body: "See which OCPP features each charger offers, including smart-charging limits, before you plan around them." },
  ...(CPMS_FEATURES.monetisation
    ? [{ icon: Handshake, title: "Paid charging", body: "Set up users, access and payment for commercial charging." }]
    : []),
];
