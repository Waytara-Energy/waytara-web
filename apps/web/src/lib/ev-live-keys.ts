/** The charger's keys the Overview follows live (the live table's names). Kept in a module of its own so the page's client code can use it
 *  without pulling in the server-side fetch. */
export const EV_LIVE_KEYS = ["power_active_import_kw", "current_import_l1_a", "voltage_l1_n_v", "energy_active_import_register_kwh", "connector_status", "error_code"];
