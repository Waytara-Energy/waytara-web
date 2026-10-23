import { describe, expect, it } from "vitest";
import { DEFAULT_APPEARANCE, appearanceToJson, parseAppearance, textPercent } from "./appearance-prefs";

describe("parseAppearance", () => {
  it("is the default for nothing or rubbish", () => {
    expect(parseAppearance(null)).toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance({ appearance: "x" })).toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance({ appearance: { text_size: "huge", reduce_motion: "yes" } })).toEqual(DEFAULT_APPEARANCE);
  });
  it("reads a valid choice and round-trips", () => {
    const p = { textSize: "lg" as const, reduceMotion: true };
    expect(parseAppearance({ appearance: appearanceToJson(p) })).toEqual(p);
  });
  it("gives the percentage of a size", () => {
    expect(textPercent("md")).toBe(100);
    expect(textPercent("xl")).toBe(120);
  });
});
