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

/** `sites.power_package` — what equipment the site actually has, which
 *  the energy-flow diagram uses to decide which wires can ever show
 *  (on top of each wire's own live-reading check). Independent of
 *  `power_source_category` above, which separately governs the Grid
 *  wire only. */
export const POWER_PACKAGE_LABELS: Record<string, string> = {
  solar_inverter: "Solar + Inverter",
  solar_battery_inverter: "Solar + Battery + Inverter",
  inverter_battery: "Inverter + Battery",
  solar_inverter_ev: "Solar + Inverter + EV Charger",
  solar_battery_inverter_ev: "Solar + Battery + Inverter + EV Charger",
  inverter_battery_ev: "Inverter + Battery + EV Charger",
  ev_charger_only: "EV Charger Only",
};

export const PROPERTY_TYPE_OPTIONS = Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => ({ value, label }));
export const POWER_SOURCE_OPTIONS = Object.entries(POWER_SOURCE_LABELS).map(([value, label]) => ({ value, label }));
export const POWER_PACKAGE_OPTIONS = Object.entries(POWER_PACKAGE_LABELS).map(([value, label]) => ({ value, label }));

export interface SiteAddress {
  line1?: string;
  city?: string;
  state?: string;
  pincode?: string;
}
