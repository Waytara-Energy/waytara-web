// The WayTara map: our own style for the OpenFreeMap vector tiles (the OpenMapTiles layout), in a light and a dark theme that follow the
// app's own colours (green accent, soft neutral land), with roads and their names, buildings flat or raised (3D), and nothing else: no
// shops, hospitals, bus stops or place names. A style is plain data, so it is built here and tested.
import type { LayerSpecification, StyleSpecification } from "maplibre-gl";

export type MapTheme = "light" | "dark";

/** The raised buildings; switched on and off with the 3D button. */
export const BUILDINGS_3D_LAYER = "buildings-3d";
/** The building of the site, painted green: its outline is put into this source by the page, and the layers below show it flat and raised. */
export const SITE_BUILDING_SOURCE = "site-building";
export const SITE_BUILDING_3D_LAYER = "site-building-3d";

const TILES = "https://tiles.openfreemap.org/planet";
const GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
const ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
const FONT = ["Noto Sans Regular"];

interface Palette {
  land: string;
  wood: string;
  grass: string;
  park: string;
  residential: string;
  industrial: string;
  institution: string;
  water: string;
  building: string;
  buildingLine: string;
  tall: [low: string, mid: string, high: string];
  rail: string;
  site: { fill: string; line: string };
  path: string;
  minor: { casing: string; fill: string };
  mid: { casing: string; fill: string };
  primary: { casing: string; fill: string };
  motorway: { casing: string; fill: string };
  label: string;
  halo: string;
}

// Light: soft green-tinted neutrals, white streets, the brand green on the main roads. Dark: the dashboard's own near-black greens.
const PALETTE: Record<MapTheme, Palette> = {
  light: {
    land: "#f3f6f2",
    wood: "#dcebd8",
    grass: "#e6f1e2",
    park: "#d3e9d0",
    residential: "#eef3ed",
    industrial: "#e9ede7",
    institution: "#eef0e6",
    water: "#bfe1ea",
    building: "#e3e8e0",
    buildingLine: "#cfd7cc",
    tall: ["#d6ddd3", "#c2ccbf", "#aab8a7"],
    rail: "#c3cbc1",
    site: { fill: "#16a34a", line: "#15803d" },
    path: "#c9d2c7",
    minor: { casing: "#d6ddd4", fill: "#ffffff" },
    mid: { casing: "#bccab9", fill: "#ffffff" },
    primary: { casing: "#8fcda4", fill: "#dff3e5" },
    motorway: { casing: "#5fb67d", fill: "#bfe6cc" },
    label: "#33443a",
    halo: "#ffffff",
  },
  dark: {
    land: "#0f1613",
    wood: "#122319",
    grass: "#112018",
    park: "#14281c",
    residential: "#111a16",
    industrial: "#0e1613",
    institution: "#131c17",
    water: "#0b2128",
    building: "#1a2520",
    buildingLine: "#24322b",
    tall: ["#1d2a24", "#2a3b33", "#394e44"],
    rail: "#25322b",
    site: { fill: "#4ade80", line: "#86efac" },
    path: "#2a3831",
    minor: { casing: "#0a100d", fill: "#202c26" },
    mid: { casing: "#0a100d", fill: "#283730" },
    primary: { casing: "#0b120e", fill: "#31503f" },
    motorway: { casing: "#0b120e", fill: "#3b6a4e" },
    label: "#a9bdb1",
    halo: "#0a0f0d",
  },
};

type Stops = [zoom: number, width: number][];
const width = (stops: Stops, extra = 0) => ["interpolate", ["exponential", 1.5], ["zoom"], ...stops.flatMap(([z, w]) => [z, w + extra * Math.min(1, z / 14)])] as never;
const is = (...classes: string[]) => ["in", ["get", "class"], ["literal", classes]] as never;

const ROADS: { id: string; classes: string[]; minzoom: number; stops: Stops; colors: (p: Palette) => { casing: string; fill: string } }[] = [
  { id: "minor", classes: ["minor", "service"], minzoom: 13, stops: [[13, 0.6], [16, 3.5], [20, 14]], colors: (p) => p.minor },
  { id: "mid", classes: ["secondary", "tertiary"], minzoom: 10, stops: [[10, 0.5], [13, 1.5], [16, 5.5], [20, 18]], colors: (p) => p.mid },
  { id: "primary", classes: ["primary"], minzoom: 7, stops: [[7, 0.5], [12, 2], [16, 7], [20, 22]], colors: (p) => p.primary },
  { id: "motorway", classes: ["motorway", "trunk"], minzoom: 5, stops: [[5, 0.5], [12, 2.5], [16, 8], [20, 26]], colors: (p) => p.motorway },
];

/** The style for a theme. `threeD` decides whether the buildings start raised (the page toggles that layer afterwards). */
export function mapStyle(theme: MapTheme, threeD = false): StyleSpecification {
  const p = PALETTE[theme];
  const road = (classes: string[]) => ["all", is(...classes), ["!=", ["get", "brunnel"], "tunnel"]] as never;

  const layers: LayerSpecification[] = [
    { id: "land", type: "background", paint: { "background-color": p.land } },
    {
      id: "landcover",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landcover",
      paint: { "fill-color": ["match", ["get", "class"], "wood", p.wood, "grass", p.grass, "farmland", p.grass, "wetland", p.grass, p.land] as never },
    },
    {
      id: "landuse",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landuse",
      paint: {
        "fill-color": ["match", ["get", "class"], ["residential", "suburb", "neighbourhood"], p.residential, ["industrial", "commercial", "retail"], p.industrial, ["hospital", "school", "college", "university", "kindergarten"], p.institution, ["cemetery", "pitch", "playground", "stadium", "track"], p.park, p.land] as never,
      },
    },
    { id: "park", type: "fill", source: "openmaptiles", "source-layer": "park", paint: { "fill-color": p.park, "fill-opacity": 0.9 } },
    { id: "water", type: "fill", source: "openmaptiles", "source-layer": "water", paint: { "fill-color": p.water } },
    { id: "waterway", type: "line", source: "openmaptiles", "source-layer": "waterway", paint: { "line-color": p.water, "line-width": width([[8, 0.5], [14, 2], [18, 6]]) } },
    {
      id: "rail",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      minzoom: 11,
      filter: is("rail"),
      paint: { "line-color": p.rail, "line-width": width([[11, 0.5], [16, 2]]), "line-dasharray": [3, 2] },
    },
    {
      id: "path",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      minzoom: 15,
      filter: is("path", "track"),
      paint: { "line-color": p.path, "line-width": width([[15, 0.5], [18, 2], [20, 3]]), "line-dasharray": [2, 2] },
    },
    // buildings lie flat under the roads ...
    {
      id: "buildings",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "building",
      minzoom: 13,
      paint: { "fill-color": p.building, "fill-outline-color": p.buildingLine, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0, 15, 1] as never },
    },
    // ... the site's own building on top of them, in green
    { id: "site-building-fill", type: "fill", source: SITE_BUILDING_SOURCE, paint: { "fill-color": p.site.fill, "fill-opacity": 0.45 } },
    { id: "site-building-line", type: "line", source: SITE_BUILDING_SOURCE, paint: { "line-color": p.site.line, "line-width": 2, "line-opacity": 0.9 } },
  ];

  // ... then each road class: all the casings first (so a junction is clean), then the fills, smallest class first.
  for (const r of ROADS) layers.push({ id: `${r.id}-casing`, type: "line", source: "openmaptiles", "source-layer": "transportation", minzoom: r.minzoom, filter: road(r.classes), layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": r.colors(p).casing, "line-width": width(r.stops, 1.6) } });
  for (const r of ROADS) layers.push({ id: `${r.id}-fill`, type: "line", source: "openmaptiles", "source-layer": "transportation", minzoom: r.minzoom, filter: road(r.classes), layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": r.colors(p).fill, "line-width": width(r.stops) } });

  layers.push(
    // ... and the raised buildings above them, only when 3D is on.
    {
      id: BUILDINGS_3D_LAYER,
      type: "fill-extrusion",
      source: "openmaptiles",
      "source-layer": "building",
      minzoom: 14,
      layout: { visibility: threeD ? "visible" : "none" },
      paint: {
        "fill-extrusion-color": ["interpolate", ["linear"], ["coalesce", ["get", "render_height"], 9], 0, p.tall[0], 40, p.tall[1], 150, p.tall[2]] as never,
        "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 14, 0, 15.5, ["coalesce", ["get", "render_height"], 9]] as never,
        "fill-extrusion-base": ["interpolate", ["linear"], ["zoom"], 14, 0, 15.5, ["coalesce", ["get", "render_min_height"], 0]] as never,
        "fill-extrusion-opacity": 0.94,
        "fill-extrusion-vertical-gradient": true,
      },
    },
    // the site's building, raised as well (a hair higher than its neighbours, so it is not hidden by its own copy)
    {
      id: SITE_BUILDING_3D_LAYER,
      type: "fill-extrusion",
      source: SITE_BUILDING_SOURCE,
      layout: { visibility: threeD ? "visible" : "none" },
      paint: {
        "fill-extrusion-color": p.site.fill,
        "fill-extrusion-height": ["+", ["coalesce", ["get", "render_height"], 9], 0.3] as never,
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0] as never,
        "fill-extrusion-opacity": 0.7,
        "fill-extrusion-vertical-gradient": true,
      },
    },
    // the only labels: road names
    {
      id: "road-names",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "transportation_name",
      minzoom: 13,
      layout: {
        "symbol-placement": "line",
        "symbol-spacing": 320,
        "text-field": ["coalesce", ["get", "name:latin"], ["get", "name:en"], ["get", "name"]] as never,
        "text-font": FONT,
        "text-size": ["interpolate", ["linear"], ["zoom"], 13, 10, 18, 13.5] as never,
        "text-letter-spacing": 0.02,
        "text-max-angle": 30,
      },
      paint: { "text-color": p.label, "text-halo-color": p.halo, "text-halo-width": 1.5, "text-halo-blur": 0.5 },
    }
  );

  return {
    version: 8,
    name: `WayTara ${theme}`,
    glyphs: GLYPHS,
    sources: { openmaptiles: { type: "vector", url: TILES, attribution: ATTRIBUTION }, [SITE_BUILDING_SOURCE]: { type: "geojson", data: { type: "FeatureCollection", features: [] } } },
    layers,
  };
}
