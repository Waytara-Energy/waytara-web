/** Display labels + option lists for `sites.property_type` and
 *  `sites.power_source_category` (both Postgres enums) — shared between
 *  the read-only Sites & Devices list and the editable Site Setting tab
 *  on Instrument Settings, so the two never drift out of sync. */

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  residential_independent_villas: "Residential & Independent Villas",
  gated_communities_rwas_high_rises: "Gated Communities, RWAs & High-Rises",
  factories_heavy_engineering_processing_plants: "Factories, Heavy Engineering & Processing Plants",
  corporate_offices_hospitals_hotels_retail: "Corporate Offices, Hospitals, Hotels & Retail",
  logistics_delivery_hubs_bus_depots: "Logistics, Delivery Hubs & Bus Depots",
  tech_parks_data_centers_rnd_hubs: "Tech Parks, Data Centers & R&D Hubs",
};

export const POWER_SOURCE_LABELS: Record<string, string> = {
  grid_tied: "Grid Tied",
  off_grid: "Off Grid",
  hybrid: "Hybrid",
};

export const PROPERTY_TYPE_OPTIONS = Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => ({ value, label }));
export const POWER_SOURCE_OPTIONS = Object.entries(POWER_SOURCE_LABELS).map(([value, label]) => ({ value, label }));

export interface SiteAddress {
  line1?: string;
  city?: string;
  state?: string;
  pincode?: string;
}
