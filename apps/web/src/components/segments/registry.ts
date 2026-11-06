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

/** The six property types, one page each (docs/WEBSITE_PLAN.md section 7), keyed by a short name. The address of each page is its own `path`. */
export const SEGMENT_PAGES: Record<string, SegmentPageEntry> = {
  home: { Page: HomesPage, title: "Home & Villa Solar with Battery Backup & EV Charging", description: HOMES_DESCRIPTION, path: HOMES_PATH },
  commercial: { Page: CommercialPage, title: "Commercial Solar, Storage & EV Charging", description: COMMERCIAL_DESCRIPTION, path: COMMERCIAL_PATH },
  factory: { Page: FactoryPage, title: "Industrial Solar, Battery Storage & EMS", description: FACTORY_DESCRIPTION, path: FACTORY_PATH },
  ev_fleet: { Page: EvFleetPage, title: "EV Fleet Charging Management (CPMS) with Solar", description: EV_FLEET_DESCRIPTION, path: EV_FLEET_PATH },
  it_park: { Page: ItParkPage, title: "Solar, Storage & EV Charging for IT Parks", description: IT_PARK_DESCRIPTION, path: IT_PARK_PATH },
  apartment: { Page: ApartmentsPage, title: "Solar & EV Charging for Apartments and RWAs", description: APARTMENTS_DESCRIPTION, path: APARTMENTS_PATH },
};

const slugOf = (path: string) => path.split("/").pop() ?? "";

/** The last part of each page's address: home, apartment, commercial, factory, ev-fleet, it-park. */
export const SEGMENT_SLUGS: string[] = Object.values(SEGMENT_PAGES).map((e) => slugOf(e.path));

/** The page whose address ends in exactly this slug, or undefined for anything else. */
export function segmentForSlug(slug: string): SegmentPageEntry | undefined {
  return Object.values(SEGMENT_PAGES).find((e) => slugOf(e.path) === slug);
}

/** The real slug for an older spelling with underscores (ev_fleet, it_park), so those addresses can be sent on to the right one. */
export function canonicalSlug(slug: string): string | undefined {
  const hyphenated = slug.replace(/_/g, "-");
  return hyphenated !== slug && segmentForSlug(hyphenated) ? hyphenated : undefined;
}
