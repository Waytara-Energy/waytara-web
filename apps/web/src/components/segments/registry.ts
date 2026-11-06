import type { ComponentType } from "react";
import { APARTMENTS_DESCRIPTION, APARTMENTS_PATH, ApartmentsPage } from "./apartments-page";
import { COMMERCIAL_DESCRIPTION, COMMERCIAL_PATH, CommercialPage } from "./commercial-page";
import { EV_FLEET_DESCRIPTION, EV_FLEET_PATH, EvFleetPage } from "./ev-fleet-page";
import { FACTORY_DESCRIPTION, FACTORY_PATH, FactoryPage } from "./factory-page";
import { IT_PARK_DESCRIPTION, IT_PARK_PATH, ItParkPage } from "./it-park-page";
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
  home: { Page: HomesPage, title: "Home & Villa Solar with Battery Backup & EV Charging", description: HOMES_DESCRIPTION, path: HOMES_PATH },
  commercial: { Page: CommercialPage, title: "Commercial Solar, Storage & EV Charging", description: COMMERCIAL_DESCRIPTION, path: COMMERCIAL_PATH },
  factory: { Page: FactoryPage, title: "Industrial Solar, Battery Storage & EMS", description: FACTORY_DESCRIPTION, path: FACTORY_PATH },
  ev_fleet: { Page: EvFleetPage, title: "EV Fleet Charging Management (CPMS) with Solar", description: EV_FLEET_DESCRIPTION, path: EV_FLEET_PATH },
  it_park: { Page: ItParkPage, title: "Solar, Storage & EV Charging for IT Parks", description: IT_PARK_DESCRIPTION, path: IT_PARK_PATH },
  apartment: { Page: ApartmentsPage, title: "Solar & EV Charging for Apartments and RWAs", description: APARTMENTS_DESCRIPTION, path: APARTMENTS_PATH },
};
