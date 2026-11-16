import { describe, expect, it } from "vitest";
import { partnersCovering, readListedPartners } from "./partner-directory";

describe("readListedPartners", () => {
  it("reads the rows of the directory function and maps a place that is not a district to its district", () => {
    const rows = [
      { name: " Sun Electricals ", partner_type: "contractor", districts: ["Chennai", "Hosur"] },
      { name: "Volt Charge", partner_type: "ev", districts: ["Madurai"] },
    ];
    expect(readListedPartners(rows)).toEqual([
      { name: "Sun Electricals", type: "contractor", districts: ["Chennai", "Krishnagiri"] },
      { name: "Volt Charge", type: "ev", districts: ["Madurai"] },
    ]);
  });

  it("leaves out rows without a name, with an unknown kind or without districts, and anything that is not a list", () => {
    expect(readListedPartners([{ name: "", partner_type: "ev", districts: [] }, { name: "A", partner_type: "plumber", districts: ["Salem"] }, { name: "B", partner_type: "ev" }, null, 7])).toEqual([]);
    expect(readListedPartners(null)).toEqual([]);
    expect(readListedPartners({})).toEqual([]);
  });
});

describe("partnersCovering", () => {
  const partners = [
    { name: "A", type: "contractor" as const, districts: ["Chennai", "Vellore"] },
    { name: "B", type: "solar" as const, districts: ["Madurai"] },
  ];
  it("finds the partners that cover any of the districts", () => {
    expect(partnersCovering(partners, ["Vellore", "Ranipet"]).map((p) => p.name)).toEqual(["A"]);
    expect(partnersCovering(partners, ["Chennai", "Madurai"]).map((p) => p.name)).toEqual(["A", "B"]);
  });
  it("finds none where nobody is listed", () => {
    expect(partnersCovering(partners, ["Theni"])).toEqual([]);
    expect(partnersCovering([], ["Chennai"])).toEqual([]);
  });
});
