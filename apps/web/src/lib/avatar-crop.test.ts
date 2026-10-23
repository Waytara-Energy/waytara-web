import { describe, expect, it } from "vitest";
import { MAX_ZOOM, MIN_ZOOM, START_CROP, clampOffset, clampZoom, coverScale, settle, turn, turnedSize, zoomTo } from "./avatar-crop";

describe("turning", () => {
  it("goes round in quarter turns, either way", () => {
    expect(turn(0, 1)).toBe(90);
    expect(turn(270, 1)).toBe(0);
    expect(turn(0, -1)).toBe(270);
    expect(turn(90, -3)).toBe(180);
  });
  it("swaps the sides on a quarter turn", () => {
    expect(turnedSize(400, 300, 0)).toEqual({ w: 400, h: 300 });
    expect(turnedSize(400, 300, 90)).toEqual({ w: 300, h: 400 });
    expect(turnedSize(400, 300, 180)).toEqual({ w: 400, h: 300 });
  });
});

describe("coverScale", () => {
  it("makes the shorter side just fill the window", () => {
    expect(coverScale(400, 200, 0, 100)).toBe(0.5);
    expect(coverScale(200, 400, 0, 100)).toBe(0.5);
    expect(coverScale(400, 200, 90, 100)).toBe(0.5);
  });
});

describe("clampOffset", () => {
  it("lets a wide picture slide sideways only as far as it still covers the window", () => {
    // 400x200 in a 100 window: scale 0.5, shown 200x100 -> 50 px of play each way sideways, none up or down
    expect(clampOffset(400, 200, { ...START_CROP, x: 999, y: 999 }, 100)).toEqual({ x: 50, y: 0 });
    expect(clampOffset(400, 200, { ...START_CROP, x: -999, y: -5 }, 100)).toEqual({ x: -50, y: 0 });
  });
  it("gives more room as the zoom grows", () => {
    expect(clampOffset(200, 200, { ...START_CROP, zoom: 2, x: 999, y: -999 }, 100)).toEqual({ x: 50, y: -50 });
  });
  it("keeps a square picture still at zoom 1", () => {
    expect(clampOffset(500, 500, { ...START_CROP, x: 30, y: 30 }, 100)).toEqual({ x: 0, y: 0 });
  });
});

describe("zoom", () => {
  it("stays between the least and the most", () => {
    expect(clampZoom(0.2)).toBe(MIN_ZOOM);
    expect(clampZoom(9)).toBe(MAX_ZOOM);
    expect(clampZoom(Number.NaN)).toBe(MIN_ZOOM);
  });
  it("keeps what is in the middle in the middle", () => {
    const c = zoomTo(200, 200, { ...START_CROP, zoom: 2, x: 20, y: -10 }, 3, 100);
    expect(c.zoom).toBe(3);
    expect(c.x).toBe(30);
    expect(c.y).toBe(-15);
  });
  it("pulls the picture back to cover the window when zooming out", () => {
    const c = zoomTo(200, 200, { ...START_CROP, zoom: 4, x: 150, y: 0 }, 1, 100);
    expect(c.x).toBe(0);
  });
  it("settle repairs a zoom and an offset that are out of range", () => {
    expect(settle(200, 200, { rotation: 0, zoom: 99, x: 9999, y: -9999 }, 100)).toEqual({ rotation: 0, zoom: MAX_ZOOM, x: 150, y: -150 });
  });
});
