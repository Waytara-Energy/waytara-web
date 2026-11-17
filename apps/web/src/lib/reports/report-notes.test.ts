import { describe, expect, it } from "vitest";
import { co2Lines, evNotes, inverterNotes, tariffLines } from "./report-notes";

const TARIFF = "Tamil Nadu residential tariff, in force since 10 May 2026, indicative: not yet checked against the regulator order";
const CO2 = "0.71 kg CO2/kWh - CEA CO2 Baseline Database v21.0, weighted average, 2024-25, provisional";

describe("the tariff note", () => {
  it("puts the warning on a line of its own", () => {
    expect(tariffLines(TARIFF)).toEqual(["Tamil Nadu residential tariff, in force since 10 May 2026.", "Indicative: not yet checked against the regulator order."]);
  });
  it("is one sentence when nothing is flagged, and empty when empty", () => {
    expect(tariffLines("Tamil Nadu residential tariff, in force since 10 May 2026")).toEqual(["Tamil Nadu residential tariff, in force since 10 May 2026."]);
    expect(tariffLines("")).toEqual([]);
  });
});

describe("the CO2 note", () => {
  it("splits the factor, the name of its source and what kind of figure it is", () => {
    expect(co2Lines(CO2)).toEqual(["0.71 kg CO2/kWh", "CEA CO2 Baseline Database v21.0", "Weighted average, 2024-25, provisional."]);
  });
  it("copes with a source that has no extra details", () => {
    expect(co2Lines("0.71 kg CO2/kWh - CEA CO2 Baseline Database v21.0")).toEqual(["0.71 kg CO2/kWh", "CEA CO2 Baseline Database v21.0"]);
  });
  it("keeps an unexpected note whole", () => {
    expect(co2Lines("about 0.7 kg per unit")).toEqual(["About 0.7 kg per unit."]);
  });
});

describe("the notes under a report", () => {
  it("lists the source, the tariff, the CO2 factor and the time zone, each with its own icon", () => {
    const n = inverterNotes({ tariffNote: TARIFF, co2Note: CO2 });
    expect(n.map((x) => x.icon)).toEqual(["meter", "tag", "leaf", "clock"]);
    expect(n[0].lines.join(" ")).toContain("not the electricity board's meter");
    expect(n[3].lines).toEqual(["All times are IST (India)."]);
  });
  it("leaves out the tariff and the CO2 factor when there are none", () => {
    expect(inverterNotes({ tariffNote: "", co2Note: null }).map((x) => x.icon)).toEqual(["meter", "clock"]);
  });
  it("has its own wording for the EV charging report", () => {
    const n = evNotes();
    expect(n.map((x) => x.icon)).toEqual(["bolt", "info", "clock"]);
    expect(n[0].lines.join(" ")).toContain("charger's own meter");
    expect(n[1].lines).toEqual(["Test sessions are left out."]);
  });
  it("never uses a character the PDF's built-in font cannot draw", () => {
    for (const note of [...inverterNotes({ tariffNote: TARIFF, co2Note: CO2 }), ...evNotes()]) {
      for (const line of [note.title, ...note.lines]) expect(/^[\x20-\x7e]*$/.test(line)).toBe(true);
    }
  });
});
