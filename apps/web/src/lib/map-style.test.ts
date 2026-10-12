import { describe, expect, it } from "vitest";
import { BUILDINGS_3D_LAYER, SITE_BUILDING_3D_LAYER, SITE_BUILDING_SOURCE, mapStyle } from "./map-style";

describe("mapStyle", () => {
  for (const theme of ["light", "dark"] as const) {
    const style = mapStyle(theme);

    it(`${theme}: every layer has its own id and a source that exists`, () => {
      const ids = style.layers.map((l) => l.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const l of style.layers) if ("source" in l && l.source) expect(Object.keys(style.sources)).toContain(l.source);
    });

    it(`${theme}: the only labels are road names`, () => {
      expect(style.layers.filter((l) => l.type === "symbol").map((l) => l.id)).toEqual(["road-names"]);
    });
  }

  it("has the same layers in both themes, so a theme change only recolours", () => {
    expect(mapStyle("light").layers.map((l) => l.id)).toEqual(mapStyle("dark").layers.map((l) => l.id));
  });

  it("raises the buildings only when 3D is on, above the roads and below the labels", () => {
    const visibility = (threeD: boolean) => (mapStyle("light", threeD).layers.find((l) => l.id === BUILDINGS_3D_LAYER)?.layout as { visibility?: string } | undefined)?.visibility;
    expect(visibility(false)).toBe("none");
    expect(visibility(true)).toBe("visible");
    const ids = mapStyle("dark").layers.map((l) => l.id);
    expect(ids.indexOf(BUILDINGS_3D_LAYER)).toBeGreaterThan(ids.indexOf("motorway-fill"));
    expect(ids.indexOf(BUILDINGS_3D_LAYER)).toBeLessThan(ids.indexOf("road-names"));
  });

  it("has a green layer for the site's building, flat and raised", () => {
    const style = mapStyle("light", true);
    expect(Object.keys(style.sources)).toContain(SITE_BUILDING_SOURCE);
    const ids = style.layers.map((l) => l.id);
    expect(ids).toEqual(expect.arrayContaining(["site-building-fill", "site-building-line", SITE_BUILDING_3D_LAYER]));
    expect(ids.indexOf("site-building-fill")).toBeGreaterThan(ids.indexOf("buildings"));
    expect((mapStyle("light", false).layers.find((l) => l.id === SITE_BUILDING_3D_LAYER)?.layout as { visibility?: string }).visibility).toBe("none");
  });

  it("credits the tile and data sources", () => {
    const source = mapStyle("light").sources.openmaptiles as { attribution?: string };
    expect(source.attribution).toContain("OpenFreeMap");
    expect(source.attribution).toContain("OpenStreetMap");
  });
});
