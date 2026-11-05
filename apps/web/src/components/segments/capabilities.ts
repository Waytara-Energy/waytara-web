/**
 * What the segment pages may claim about WayTara CPMS. These are OFF until the capability is confirmed in the product: the hub accepts
 * every charge authorisation, has no tariff or billing records, and sends no charging-limit commands (docs/WEBSITE_PROGRESS.md, task 4d).
 * Turn one on and the matching copy appears on the EV Fleets and IT Parks pages; nothing else needs to change.
 */
export const CPMS_FEATURES = {
  /** Billing, tariffs, access control and paid charging as a commercial service. */
  monetisation: false,
  /** CPMS sets charging limits on compatible chargers to share site capacity. */
  loadAllocation: false,
};
