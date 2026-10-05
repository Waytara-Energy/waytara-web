import { describe, expect, it } from "vitest";
import { decode, encode } from "./register-codec.mjs";

const r = (register, raw) => ({ register, raw });

describe("decode", () => {
  it("returns the raw value when no spec is given", () => {
    expect(decode([r(184, 87)], null)).toBe(87);
  });

  it("applies scale", () => {
    expect(decode([r(183, 5280)], { scale: 0.01 })).toBeCloseTo(52.8);
  });

  it("treats 16-bit values >= 32768 as negative when signed", () => {
    expect(decode([r(190, 65236)], { signed: true })).toBe(-300);
    expect(decode([r(190, 1200)], { signed: true })).toBe(1200);
  });

  it("computes raw * scale + offset (Deye temperatures: raw 1000 = 0 C -> scale 0.1, offset -100)", () => {
    expect(decode([r(90, 1505)], { scale: 0.1, offset: -100 })).toBeCloseTo(50.5);
    expect(decode([r(90, 438)], { scale: 0.1, offset: -100 })).toBeCloseTo(-56.2);
    // a plain 0.1 C register with no offset (battery temperature, reg 182)
    expect(decode([r(182, 300)], { scale: 0.1 })).toBeCloseTo(30);
  });

  it("combines low/high words by register number, not array position", () => {
    // value = (high << 16) | low = 0x0001_0000 + 5 = 65541; scale 0.1
    const spec = { combine: "low_high_word", low_word_register: 78, scale: 0.1 };
    expect(decode([r(80, 1), r(78, 5)], spec)).toBeCloseTo(6554.1);
    expect(decode([r(78, 5), r(80, 1)], spec)).toBeCloseTo(6554.1);
  });

  it("rejects a combine over the wrong number of registers", () => {
    expect(() => decode([r(78, 5)], { combine: "low_high_word", low_word_register: 78 })).toThrow(/exactly 2/);
  });

  it("rejects a low_word_register that is not among the registers read", () => {
    expect(() => decode([r(1, 1), r(2, 2)], { combine: "low_high_word", low_word_register: 99 })).toThrow(/not among/);
  });
});

describe("encode (inverse of decode)", () => {
  const cases = [
    { name: "plain", value: 87, registers: [184], spec: null },
    { name: "scaled", value: 52.8, registers: [183], spec: { scale: 0.01 } },
    { name: "signed negative", value: -300, registers: [190], spec: { signed: true } },
    { name: "offset+scale", value: 50.5, registers: [90], spec: { scale: 0.1, offset: -100 } },
    { name: "32-bit words", value: 6554.1, registers: [78, 80], spec: { combine: "low_high_word", low_word_register: 78, scale: 0.1 } },
  ];

  for (const c of cases) {
    it(`round-trips: ${c.name}`, () => {
      const writes = encode(c.value, c.registers, c.spec);
      const raw = writes.map((w) => r(w.register, w.value));
      expect(decode(raw, c.spec)).toBeCloseTo(c.value, 5);
    });
  }

  it("keeps register order for 32-bit writes", () => {
    const w = encode(65541, [80, 78], { combine: "low_high_word", low_word_register: 78 });
    expect(w).toEqual([
      { register: 80, value: 1 },
      { register: 78, value: 5 },
    ]);
  });
});
