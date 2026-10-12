// Address search and "what is at this spot" for the site map. One place to call (the /api/geocode route); the service behind it is Ola Maps
// when OLA_MAPS_API_KEY is set (built for Indian addresses), otherwise Photon's public server (no key, best effort and throttled, so fine
// to try with but not to depend on). The parsing is pure and tested; the network calls are thin.

export interface Place {
  /** One line to show: "Vepery High Road, Chennai, Tamil Nadu 600007". */
  label: string;
  lat: number | null;
  lng: number | null;
  line1: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  /** The service's own id, when a result has to be looked up again to get its position. */
  placeId: string | null;
}

const clean = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
const unique = (parts: (string | null)[]) => parts.filter((p, i, a): p is string => !!p && a.indexOf(p) === i);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const pin = (v: unknown): string | null => {
  const m = /(?<!\d)(\d{3})\s?(\d{3})(?!\d)/.exec(typeof v === "string" ? v : "");
  return m ? m[1] + m[2] : null;
};

function labelOf(line1: string | null, city: string | null, state: string | null, pincode: string | null, fallback: string | null): string {
  const text = unique([line1, city, state]).join(", ") + (pincode ? ` ${pincode}` : "");
  return text.trim() || fallback || "Unnamed place";
}

// ---- Photon -------------------------------------------------------------------------------------------------------------------

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, unknown>;
}

/** Photon's GeoJSON as places. */
export function parsePhoton(json: unknown): Place[] {
  const features = (json as { features?: PhotonFeature[] } | null)?.features ?? [];
  const out: Place[] = [];
  for (const f of features) {
    const [lng, lat] = f.geometry?.coordinates ?? [];
    if (num(lat) === null || num(lng) === null) continue;
    const p = f.properties ?? {};
    const street = clean(p.street);
    const name = clean(p.name);
    const house = clean(p.housenumber);
    const area = clean(p.locality) ?? clean(p.district);
    const line1 = unique([house && street ? `${house} ${street}` : (street ?? null), name && name !== street ? name : null, area]).join(", ") || null;
    const city = clean(p.city) ?? clean(p.county);
    const state = clean(p.state);
    const pincode = pin(p.postcode);
    out.push({ label: labelOf(line1, city, state, pincode, name), lat: lat as number, lng: lng as number, line1, city, state, pincode, placeId: null });
  }
  return out;
}

// ---- Ola Maps -----------------------------------------------------------------------------------------------------------------

interface OlaComponent {
  long_name?: string;
  types?: string[];
}
interface OlaResult {
  formatted_address?: string;
  description?: string;
  name?: string;
  place_id?: string;
  address_components?: OlaComponent[];
  geometry?: { location?: { lat?: number; lng?: number } };
  structured_formatting?: { main_text?: string; secondary_text?: string };
}

const component = (r: OlaResult, ...types: string[]) => clean((r.address_components ?? []).find((c) => types.some((t) => c.types?.includes(t)))?.long_name);

function olaPlace(r: OlaResult): Place | null {
  const lat = num(r.geometry?.location?.lat);
  const lng = num(r.geometry?.location?.lng);
  const full = clean(r.formatted_address) ?? clean(r.description);
  if (!full && !r.place_id) return null;
  const pincode = component(r, "postal_code") ?? pin(full);
  // The parts of the full address, without the country and the PIN code (the state comes with its PIN: "Tamil Nadu 600003").
  const segments = (full ?? "")
    .split(",")
    .map((x) => x.replace(/\b\d{6}\b/, "").trim())
    .filter((x) => x && x !== "India");
  let city = component(r, "locality", "administrative_area_level_2");
  let state = component(r, "administrative_area_level_1");
  const named = unique([component(r, "street_number", "premise"), component(r, "route", "street_address"), component(r, "sublocality_level_1", "sublocality", "neighborhood")]);
  let line1: string | null = named.length > 0 ? named.join(", ") : null;
  if (!city && !state && !line1 && segments.length >= 3) {
    // No parts given: the address reads "street, area, city, state".
    state = segments[segments.length - 1];
    city = segments[segments.length - 2];
    line1 = segments.slice(0, -2).slice(0, 3).join(", ") || null;
  } else if (!line1) {
    line1 = segments.filter((x) => x !== city && x !== state).slice(0, 3).join(", ") || null;
  }
  return { label: full ?? labelOf(line1, city, state, pincode, null), lat, lng, line1, city, state, pincode, placeId: clean(r.place_id) };
}

/** Ola's autocomplete answer ("predictions"); a prediction may carry no position, then it is looked up by placeId when chosen. */
export function parseOlaPredictions(json: unknown): Place[] {
  const list = (json as { predictions?: OlaResult[] } | null)?.predictions ?? [];
  return list.map(olaPlace).filter((p): p is Place => p !== null);
}

/** Ola's reverse-geocode ("results") or place-details ("result") answer: the first place in it. */
export function parseOlaPlace(json: unknown): Place | null {
  const j = json as { results?: OlaResult[]; geocodingResults?: OlaResult[]; result?: OlaResult } | null;
  const r = j?.results?.[0] ?? j?.geocodingResults?.[0] ?? j?.result;
  return r ? olaPlace(r) : null;
}

// ---- network ------------------------------------------------------------------------------------------------------------------

const UA = "WayTara/1.0 (https://waytaraenergy.com; support@waytaraenergy.com)";
const PHOTON = "https://photon.komoot.io";
const OLA = "https://api.olamaps.io/places/v1";
const INDIA_BBOX = "68.1,6.7,97.5,35.7";

const olaKey = () => process.env.OLA_MAPS_API_KEY?.trim() || null;
export const geocoderName = (): "ola" | "photon" => (olaKey() ? "ola" : "photon");

async function getJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(6000), cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/** Places that match what was typed, nearest to `near` first when given. null = the service did not answer. */
export async function searchPlaces(query: string, near?: { lat: number; lng: number }): Promise<Place[] | null> {
  const key = olaKey();
  if (key) {
    const json = await getJson(`${OLA}/autocomplete?input=${encodeURIComponent(query)}${near ? `&location=${near.lat},${near.lng}` : ""}&api_key=${encodeURIComponent(key)}`);
    return json ? parseOlaPredictions(json).slice(0, 6) : null;
  }
  const json = await getJson(`${PHOTON}/api/?q=${encodeURIComponent(query)}&limit=6&lang=en&bbox=${INDIA_BBOX}${near ? `&lat=${near.lat}&lon=${near.lng}` : ""}`);
  return json ? parsePhoton(json) : null;
}

/** The address at a spot on the map. null = the service did not answer; a place with no address parts when it knows nothing there. */
export async function reversePlace(lat: number, lng: number): Promise<Place | null> {
  const key = olaKey();
  if (key) {
    const json = await getJson(`${OLA}/reverse-geocode?latlng=${lat},${lng}&api_key=${encodeURIComponent(key)}`);
    const place = json ? parseOlaPlace(json) : null;
    return place ? { ...place, lat, lng } : null;
  }
  const json = await getJson(`${PHOTON}/reverse?lat=${lat}&lon=${lng}&lang=en`);
  const place = json ? parsePhoton(json)[0] : null;
  return place ? { ...place, lat, lng } : null;
}

/** The position of a result that came without one (Ola's autocomplete). */
export async function placeById(placeId: string): Promise<Place | null> {
  const key = olaKey();
  if (!key) return null;
  const json = await getJson(`${OLA}/details?place_id=${encodeURIComponent(placeId)}&api_key=${encodeURIComponent(key)}`);
  return json ? parseOlaPlace(json) : null;
}

/** The place a PIN code is in (its city and state). undefined = the service did not answer; null = it knows no such PIN code. Needs the Ola
 *  key: Photon does not find PIN codes reliably, so without it nothing is looked up. */
export async function placeForPincode(pin: string): Promise<Place | null | undefined> {
  const key = olaKey();
  if (!key) return undefined;
  const json = await getJson(`${OLA}/geocode?address=${encodeURIComponent(pin)}&api_key=${encodeURIComponent(key)}`);
  if (!json) return undefined;
  const place = parseOlaPlace(json);
  return place && place.pincode === pin ? place : null;
}
