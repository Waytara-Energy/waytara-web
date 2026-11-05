import type { ComponentType } from "react";
import { APARTMENTS_DESCRIPTION, APARTMENTS_PATH, ApartmentsPage } from "./apartments-page";
import { HOMES_DESCRIPTION, HOMES_PATH, HomesPage } from "./homes-page";

export interface SegmentPageEntry {
  Page: ComponentType;
  title: string;
  description: string;
  path: string;
}

/**
 * Segments already rebuilt on the shared template (docs/WEBSITE_PLAN.md section 7), keyed by the normalised slug. Any segment missing here
 * still shows the old package view until its page is rebuilt.
 */
export const SEGMENT_PAGES: Record<string, SegmentPageEntry> = {
  home: { Page: HomesPage, title: "Solar, Battery Backup & EV Charging for Homes", description: HOMES_DESCRIPTION, path: HOMES_PATH },
  apartment: { Page: ApartmentsPage, title: "Solar, Backup & EV Charging for Apartments, RWAs & Developers", description: APARTMENTS_DESCRIPTION, path: APARTMENTS_PATH },
};
