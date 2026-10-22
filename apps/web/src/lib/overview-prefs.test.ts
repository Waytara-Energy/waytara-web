import { describe, expect, it } from "vitest";
import { BACKGROUND_PRESETS, DEFAULT_OVERVIEW_CARDS, backgroundCss, isBackgroundPathOf, overviewToJson, parseOverviewPrefs, splitCards } from "./overview-prefs";

const UID = "11111111-2222-3333-4444-555555555555";

describe("parseOverviewPrefs", () => {
  it("is the default for nothing, for rubbish and for the wrong number of cards", () => {
    expect(parseOverviewPrefs(null).cards).toEqual(DEFAULT_OVERVIEW_CARDS);
    expect(parseOverviewPrefs("x").cards).toEqual(DEFAULT_OVERVIEW_CARDS);
    expect(parseOverviewPrefs({ overview_cards: ["solar", "grid"] }).cards).toEqual(DEFAULT_OVERVIEW_CARDS);
    expect(parseOverviewPrefs({ overview_cards: ["solar", "solar", "grid", "load"] }).cards).toEqual(DEFAULT_OVERVIEW_CARDS);
    expect(parseOverviewPrefs({ overview_cards: ["solar", "nope", "grid", "load", "battery"] }).cards).toEqual(["solar", "grid", "load", "battery"]);
  });
  it("keeps a valid choice of four, in order", () => {
    expect(parseOverviewPrefs({ overview_cards: ["selfpowered", "battery", "exported", "solar"] }).cards).toEqual(["selfpowered", "battery", "exported", "solar"]);
  });
  it("accepts a preset and a picture of the right shape, and nothing else", () => {
    expect(parseOverviewPrefs({ overview_background: { kind: "preset", id: "aurora" } }).background).toEqual({ kind: "preset", id: "aurora" });
    expect(parseOverviewPrefs({ overview_background: { kind: "preset", id: "made-up" } }).background).toEqual({ kind: "none" });
    const path = `${UID}/overview-1761200000000.jpg`;
    expect(parseOverviewPrefs({ overview_background: { kind: "image", path } }).background).toEqual({ kind: "image", path });
    expect(parseOverviewPrefs({ overview_background: { kind: "image", path: "https://evil.example/x.jpg" } }).background).toEqual({ kind: "none" });
    expect(parseOverviewPrefs({ overview_background: { kind: "image", path: `${UID}/../other/overview-1761200000000.jpg` } }).background).toEqual({ kind: "none" });
  });
  it("keeps the darkening between 0 and 80", () => {
    expect(parseOverviewPrefs({ overview_dim: 500 }).dim).toBe(80);
    expect(parseOverviewPrefs({ overview_dim: -5 }).dim).toBe(0);
    expect(parseOverviewPrefs({ overview_dim: "x" }).dim).toBe(35);
  });
});

describe("overviewToJson / parse round trip", () => {
  it("reads back what it wrote", () => {
    const prefs = { cards: ["load", "solar", "grid", "imported"] as const, background: { kind: "preset", id: "dusk" } as const, dim: 50 };
    expect(parseOverviewPrefs(overviewToJson({ ...prefs, cards: [...prefs.cards] }))).toEqual({ ...prefs, cards: [...prefs.cards] });
  });
});

describe("isBackgroundPathOf", () => {
  it("accepts only the person's own picture", () => {
    expect(isBackgroundPathOf(`${UID}/overview-1761200000000.png`, UID)).toBe(true);
    expect(isBackgroundPathOf(`${UID}/overview-1761200000000.png`, "99999999-2222-3333-4444-555555555555")).toBe(false);
    expect(isBackgroundPathOf(`${UID}/avatar.png`, UID)).toBe(false);
  });
});

describe("backgroundCss and splitCards", () => {
  it("paints a preset, darkens a picture, and is null for none or a picture without an address", () => {
    expect(backgroundCss({ kind: "preset", id: "aurora" }, null, 35)).toBe(BACKGROUND_PRESETS[0].css);
    expect(backgroundCss({ kind: "image", path: `${UID}/overview-1761200000000.jpg` }, "https://x.test/a.jpg", 50)).toContain("rgba(0,0,0,0.50)");
    expect(backgroundCss({ kind: "none" }, null, 35)).toBeNull();
    expect(backgroundCss({ kind: "image", path: `${UID}/overview-1761200000000.jpg` }, null, 35)).toBeNull();
  });
  it("puts two cards each side of the flow", () => {
    expect(splitCards(["solar", "grid", "load", "battery"])).toEqual({ left: ["solar", "grid"], right: ["load", "battery"] });
  });
});
