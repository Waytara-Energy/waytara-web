import { describe, expect, it } from "vitest";
import { parseOlaPlace, parseOlaPredictions, parsePhoton } from "./geocode";

describe("parsePhoton", () => {
  const street = {
    features: [{ geometry: { coordinates: [80.2665615, 13.0853101] }, properties: { name: "Vepery High Road", locality: "Periamet", district: "Royapuram", city: "Chennai", state: "Tamil Nadu", postcode: "600012" } }],
  };
  it("reads a street into an address and a position", () => {
    expect(parsePhoton(street)).toEqual([{ label: "Vepery High Road, Periamet, Chennai, Tamil Nadu 600012", lat: 13.0853101, lng: 80.2665615, line1: "Vepery High Road, Periamet", city: "Chennai", state: "Tamil Nadu", pincode: "600012", placeId: null }]);
  });
  it("puts a house number before its street and leaves out results with no position", () => {
    const out = parsePhoton({ features: [{ geometry: { coordinates: [80.27, 13.08] }, properties: { name: "Meta Hospital", housenumber: "12", street: "Raja Muthiah Road", city: "Chennai", state: "Tamil Nadu", postcode: "600 003" } }, { properties: { name: "nowhere" } }] });
    expect(out).toHaveLength(1);
    expect(out[0].line1).toBe("12 Raja Muthiah Road, Meta Hospital");
    expect(out[0].pincode).toBe("600003");
  });
  it("is empty for anything else", () => {
    expect(parsePhoton(null)).toEqual([]);
    expect(parsePhoton({})).toEqual([]);
  });
});

describe("Ola Maps answers", () => {
  const result = {
    formatted_address: "12, Raja Muthiah Road, Periamet, Chennai, Tamil Nadu 600003, India",
    place_id: "abc",
    address_components: [
      { long_name: "12", types: ["street_number"] },
      { long_name: "Raja Muthiah Road", types: ["route"] },
      { long_name: "Chennai", types: ["locality"] },
      { long_name: "Tamil Nadu", types: ["administrative_area_level_1"] },
      { long_name: "600003", types: ["postal_code"] },
    ],
    geometry: { location: { lat: 13.0827, lng: 80.2707 } },
  };
  it("reads a reverse-geocode result", () => {
    expect(parseOlaPlace({ results: [result] })).toMatchObject({ lat: 13.0827, lng: 80.2707, line1: "12, Raja Muthiah Road", city: "Chennai", state: "Tamil Nadu", pincode: "600003", placeId: "abc" });
  });
  it("reads a place-details result", () => {
    expect(parseOlaPlace({ result })?.lat).toBe(13.0827);
  });
  it("reads predictions, which may come with no position", () => {
    const out = parseOlaPredictions({ predictions: [{ description: "Vepery, Chennai, Tamil Nadu, India", place_id: "p1" }, {}] });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ label: "Vepery, Chennai, Tamil Nadu, India", lat: null, lng: null, placeId: "p1" });
  });
  it("falls back to the first parts of the full address when it comes with no components", () => {
    const out = parseOlaPlace({ results: [{ formatted_address: "Anna Salai, Teynampet, Chennai, Tamil Nadu 600018, India" }] });
    expect(out?.line1).toBe("Anna Salai, Teynampet");
    expect(out?.pincode).toBe("600018");
  });
});

describe("Ola Maps, as the live service answers", () => {
  // Trimmed from a real reverse-geocode answer: the street is typed "street_address" and the nearest place is a hospital.
  const reverse = {
    results: [
      {
        formatted_address: "Apollo Hospital, Raja Muthiah Road, Periamet, Ward 58, Zone 5 Royapuram, Chennai, Tamil Nadu, 600003, India",
        name: "Apollo Hospital",
        place_id: "ola-platform:5000330579317",
        geometry: { location: { lng: 80.27096, lat: 13.08257 } },
        address_components: [
          { types: ["administrative_area_level_1"], long_name: "Tamil Nadu" },
          { types: ["locality"], long_name: "Chennai" },
          { types: ["sublocality"], long_name: "Periyamet" },
          { types: ["postal_code"], long_name: "600003" },
          { types: ["street_address"], long_name: "Raja Muthiah Road" },
        ],
      },
    ],
  };
  it("reads the street from a street_address component", () => {
    expect(parseOlaPlace(reverse)).toMatchObject({ line1: "Raja Muthiah Road, Periyamet", city: "Chennai", state: "Tamil Nadu", pincode: "600003" });
  });
});

describe("Ola Maps geocoding of a PIN code", () => {
  it("reads the city and state from geocodingResults", () => {
    const out = parseOlaPlace({
      geocodingResults: [
        {
          formatted_address: "Chennai, Ponneri, Tamil Nadu, 600003, India",
          geometry: { location: { lng: 80.276459, lat: 13.081752 } },
          address_components: [
            { types: ["administrative_area_level_1"], long_name: "Tamil Nadu" },
            { types: ["locality"], long_name: "Chennai" },
            { types: ["postal_code"], long_name: "600003" },
          ],
        },
      ],
    });
    expect(out).toMatchObject({ city: "Chennai", state: "Tamil Nadu", pincode: "600003" });
  });
});
