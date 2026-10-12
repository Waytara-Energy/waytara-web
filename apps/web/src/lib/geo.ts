// Small geography helpers for the site map. Pure, so they are tested.

/** The distance in metres between two points on the Earth (haversine). */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "40 m", "850 m", "3.2 km". */
export function distanceText(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10 || Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`;
}

/** Coordinates as a person reads them: 11.0168° N, 76.9558° E. */
export function coordinateText(lat: number, lng: number): string {
  return `${Math.abs(lat).toFixed(5)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(5)}° ${lng >= 0 ? "E" : "W"}`;
}

/** How far a browser position has to be from the saved site before the map asks whether to move the site there. */
export const MOVE_SITE_AFTER_M = 100;

// ---- buildings ------------------------------------------------------------------------------------------------------------------

type Ring = number[][];
type Polygon = Ring[];

/** The polygons in a GeoJSON geometry (a Polygon is one, a MultiPolygon many; anything else none). A map tile can hold every building of the
 *  tile as one MultiPolygon, so a single building has to be picked out of it. */
export function polygonsOf(geometry: { type: string; coordinates?: unknown }): Polygon[] {
  if (geometry.type === "Polygon") return [geometry.coordinates as Polygon];
  if (geometry.type === "MultiPolygon") return geometry.coordinates as Polygon[];
  return [];
}

function inRing(p: { lat: number; lng: number }, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p.lat !== yj > p.lat && p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The distance in metres from a point to the nearest edge of a ring (a flat approximation, exact enough over a building). */
function ringDistanceM(p: { lat: number; lng: number }, ring: Ring): number {
  const kx = Math.cos((p.lat * Math.PI) / 180) * 111_320;
  const ky = 110_540;
  let best = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const ax = (ring[i][0] - p.lng) * kx;
    const ay = (ring[i][1] - p.lat) * ky;
    const bx = (ring[i + 1][0] - p.lng) * kx;
    const by = (ring[i + 1][1] - p.lat) * ky;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

/** The one building a point is in; failing that the nearest building within `nearM` metres (a pin dropped just beside it); else null. */
export function buildingAt(geometries: { type: string; coordinates?: unknown }[], point: { lat: number; lng: number }, nearM = 12): { type: "Polygon"; coordinates: Polygon } | null {
  let nearest: { polygon: Polygon; d: number } | null = null;
  for (const polygon of geometries.flatMap(polygonsOf)) {
    const [outer, ...holes] = polygon;
    if (!outer) continue;
    if (inRing(point, outer) && !holes.some((h) => inRing(point, h))) return { type: "Polygon", coordinates: polygon };
    const d = ringDistanceM(point, outer);
    if (d <= nearM && (!nearest || d < nearest.d)) nearest = { polygon, d };
  }
  return nearest ? { type: "Polygon", coordinates: nearest.polygon } : null;
}
