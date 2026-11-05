import { Hammer, PlugZap, SlidersHorizontal, type LucideIcon } from "lucide-react";

export interface Offer {
  /** The anchor on the Solutions hub (#build, #charge, #manage). */
  id: "build" | "charge" | "manage";
  name: string;
  icon: LucideIcon;
  tag: string;
  title: string;
  body: string;
  /** A sentence of about the same length for each offer, for blocks set side by side (so the lines match). */
  blockBody: string;
  includes: string[];
  whoFor: string;
}

// From the website notes: three offers that can each be bought alone, or together. Shared by the landing page and the Solutions hub.
export const OFFERS: Offer[] = [
  {
    id: "build",
    name: "Build",
    icon: Hammer,
    tag: "New systems",
    title: "Build your energy system",
    body: "We design, supply and install the energy infrastructure your property needs.",
    blockBody: "We design, supply and install the solar, battery and electrical equipment your property needs.",
    includes: ["Rooftop and ground-mounted solar", "Battery energy storage", "Backup and electrical integration", "Commissioning with energy management"],
    whoFor: "Customers installing a new system or expanding an existing one.",
  },
  {
    id: "charge",
    name: "Charge",
    icon: PlugZap,
    tag: "EV charging",
    title: "Install and manage EV charging",
    body: "We install charging infrastructure and provide software to manage compatible charging stations.",
    blockBody: "We install charging infrastructure and provide software to manage compatible charging stations.",
    includes: ["Home and commercial charger installation", "WayTara's OCPP-based charging software", "Charging-station visibility and management", "Links to the wider dashboard where supported"],
    whoFor: "Homeowners, housing societies and businesses installing EV charging infrastructure.",
  },
  {
    id: "manage",
    name: "Manage",
    icon: SlidersHorizontal,
    tag: "Your existing equipment",
    title: "Connect and manage what you have",
    body: "WayTara EMS brings supported equipment you already own into one dashboard.",
    blockBody: "WayTara EMS brings the supported equipment you already own into one dashboard, with controls where it allows.",
    includes: ["Compatible inverters and EV chargers", "WayTara connectivity hardware", "One dashboard for connected equipment", "Controls where the equipment supports them"],
    whoFor: "Customers who want better visibility and management without buying a whole new installation.",
  },
];
