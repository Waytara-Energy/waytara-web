import { isPartnerType, type PartnerTypeId } from "./partner-network";

/** A partner an admin has chosen to show on the Partner Network page: the business name, the kind of partner and the districts it covers (nothing else is public). */
export interface ListedPartner {
  name: string;
  type: PartnerTypeId;
  districts: string[];
}

// The form offers a few places that are not districts of the map; each belongs to one.
const DISTRICT_OF: Record<string, string> = { Hosur: "Krishnagiri" };
const mapDistrict = (name: string) => DISTRICT_OF[name] ?? name;

/** The rows of `list_authorized_partners`, checked: anything that is not a name, a known kind and a list of districts is left out. */
export function readListedPartners(rows: unknown): ListedPartner[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((r) => {
    if (!r || typeof r !== "object") return [];
    const { name, partner_type, districts } = r as { name?: unknown; partner_type?: unknown; districts?: unknown };
    if (typeof name !== "string" || name.trim() === "" || !isPartnerType(partner_type) || !Array.isArray(districts)) return [];
    return [{ name: name.trim(), type: partner_type, districts: districts.filter((d): d is string => typeof d === "string" && d.trim() !== "").map((d) => mapDistrict(d.trim())) }];
  });
}

/** The listed partners that cover at least one of these districts (names as on the map). */
export function partnersCovering(partners: readonly ListedPartner[], districts: readonly string[]): ListedPartner[] {
  const wanted = new Set(districts);
  return partners.filter((p) => p.districts.some((d) => wanted.has(d)));
}
