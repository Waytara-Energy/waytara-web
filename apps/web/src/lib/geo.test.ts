import { describe, expect, it } from "vitest";
import { buildingAt, coordinateText, distanceMeters, distanceText } from "./geo";

describe("geo", () => {
  it("measures a short distance", () => {
    // about 111 m north
    expect(distanceMeters({ lat: 11.0, lng: 77.0 }, { lat: 11.001, lng: 77.0 })).toBeGreaterThan(105);
    expect(distanceMeters({ lat: 11.0, lng: 77.0 }, { lat: 11.001, lng: 77.0 })).toBeLessThan(118);
  });
  it("measures a long one", () => {
    // Chennai to Coimbatore is about 440 km as the crow flies
    const km = distanceMeters({ lat: 13.0827, lng: 80.2707 }, { lat: 11.0168, lng: 76.9558 }) / 1000;
    expect(km).toBeGreaterThan(420);
    expect(km).toBeLessThan(460);
  });
  it("is zero for the same point", () => {
    expect(distanceMeters({ lat: 1, lng: 2 }, { lat: 1, lng: 2 })).toBe(0);
  });
  it("writes distances and coordinates for people", () => {
    expect(distanceText(40)).toBe("40 m");
    expect(distanceText(850)).toBe("850 m");
    expect(distanceText(3200)).toBe("3.2 km");
    expect(coordinateText(11.0168, 76.9558)).toBe("11.01680° N, 76.95580° E");
    expect(coordinateText(-33.8, -70.6)).toBe("33.80000° S, 70.60000° W");
  });
});

describe("buildingAt", () => {
  // two squares about 20 m wide, 30 m apart, as one MultiPolygon (the way a map tile holds its buildings)
  const sq = (lng: number, lat: number): number[][][] => [[[lng, lat], [lng + 0.0002, lat], [lng + 0.0002, lat + 0.0002], [lng, lat + 0.0002], [lng, lat]]];
  const tile = { type: "MultiPolygon", coordinates: [sq(80.27, 13.08), sq(80.2706, 13.08)] };

  it("picks the building the point is in, not the whole tile", () => {
    const out = buildingAt([tile], { lat: 13.0801, lng: 80.2701 });
    expect(out?.coordinates).toEqual(sq(80.27, 13.08));
    expect(buildingAt([tile], { lat: 13.0801, lng: 80.2707 })?.coordinates).toEqual(sq(80.2706, 13.08));
  });
  it("takes the nearest building for a point just outside it, and none for a point far from any", () => {
    expect(buildingAt([tile], { lat: 13.0801, lng: 80.27025 })?.coordinates).toEqual(sq(80.27, 13.08)); // about 5 m east of the first
    expect(buildingAt([tile], { lat: 13.0801, lng: 80.2704 })).toBeNull(); // about 20 m from either
  });
  it("ignores geometries that are not polygons", () => {
    expect(buildingAt([{ type: "Point", coordinates: [80.27, 13.08] }], { lat: 13.08, lng: 80.27 })).toBeNull();
  });
});
