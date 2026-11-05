import type { ComponentType } from "react";
import { APARTMENTS_DESCRIPTION, APARTMENTS_PATH, ApartmentsPage } from "./apartments-page";
import { COMMERCIAL_DESCRIPTION, COMMERCIAL_PATH, CommercialPage } from "./commercial-page";
import { EV_FLEET_DESCRIPTION, EV_FLEET_PATH, EvFleetPage } from "./ev-fleet-page";
import { FACTORY_DESCRIPTION, FACTORY_PATH, FactoryPage } from "./factory-page";
import { HOMES_DESCRIPTION, HOMES_PATH, HomesPage } from "./homes-page";

export interface SegmentPageEntry {
  Page: ComponentType;
  title: string;
  description: string;
  path: string;
}

/**
 * Segments already rebuilt on the shared template (docs/WEBSITE_PLAN.md section 7), keyed by the normalised slug (normalizeSegmentSlug turns ev-fleet into ev_fleet). Any segment missing here
 * still shows the old package view until its page is rebuilt.
 */
export const SEGMENT_PAGES: Record<string, SegmentPageEntry> = {
  home: { Page: HomesPage, title: "Solar, Battery Backup & EV Charging for Homes", description: HOMES_DESCRIPTION, path: HOMES_PATH },
  commercial: { Page: CommercialPage, title: "Solar, Storage, EV Charging & Energy Management for Commercial Buildings", description: COMMERCIAL_DESCRIPTION, path: COMMERCIAL_PATH },
  factory: { Page: FactoryPage, title: "Industrial Solar, Battery Storage & EMS for Factories", description: FACTORY_DESCRIPTION, path: FACTORY_PATH },
  ev_fleet: { Page: EvFleetPage, title: "EV Fleet & Charging Infrastructure with WayTara CPMS", description: EV_FLEET_DESCRIPTION, path: EV_FLEET_PATH },
  apartment: { Page: ApartmentsPage, title: "Solar, Backup & EV Charging for Apartments, RWAs & Developers", description: APARTMENTS_DESCRIPTION, path: APARTMENTS_PATH },
};
