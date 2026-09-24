// Shared decode()/encode() engine — interprets device_parameter_map.decode
// jsonb against a register reading (decode) or an engineering value
// (encode), driven entirely by what's actually in the DB rather than any
// hardcoded per-field logic. Every rule here is derived from real seeded
// rows, verified against their own `notes` (the plain-language formula the
// seed script carried alongside each decode spec):
//
//   scale + offset : (raw + offset) * scale
//     e.g. inverter_dc_temp_c: {scale:0.1, offset:-1000} -> (v-1000)/10
//   signed          : 16-bit two's complement (raw >= 32768 ? raw-65536 : raw)
//     e.g. battery_power_w: {signed:true} -> (v>=32768 ? v-65536 : v)
//   combine: "low_high_word" + low_word_register
//     e.g. total_pv_energy_kwh: address [96,97], low_word_register 96 ->
//     ((v[97]<<16) | v[96]) * scale — the low word isn't guaranteed to be
//     the first register in `address.registers`, so this is resolved by
//     matching low_word_register against each reading's own register
//     number, never by array position.
//   anything else (a `note`-only decode, or no decode at all) : identity —
//     tou_slot*_flags and similar bit-level masks aren't decomposed into
//     named sub-fields yet (see their own notes), so the raw integer is
//     the value, both reading and writing.
//
// No write-side row in the current catalog uses a bitmask decode (checked
// against production — every write-side decode is scale/signed/identity
// only), so encode() doesn't implement read-modify-write. If a future
// vendor's model needs it, that's a real register read before the write,
// which belongs in the caller (it needs a live Modbus connection), not
// here — this module only does the pure math.

function toSigned(raw, bits) {
  const max = 2 ** bits;
  const half = max / 2;
  return raw >= half ? raw - max : raw;
}

function toUnsigned(value, bits) {
  const max = 2 ** bits;
  return value < 0 ? value + max : value;
}

/**
 * @param {{register: number, raw: number}[]} regReadings - raw register
 *   value(s) exactly as read off the wire, paired with their register
 *   numbers.
 * @param {object|null} decodeSpec - device_parameter_map.decode
 * @returns {number} the decoded engineering value
 */
export function decode(regReadings, decodeSpec) {
  const spec = decodeSpec ?? {};
  let raw;

  if (spec.combine === "low_high_word") {
    if (regReadings.length !== 2) {
      throw new Error(`low_high_word combine needs exactly 2 registers, got ${regReadings.length}`);
    }
    const low = regReadings.find((r) => r.register === spec.low_word_register);
    const high = regReadings.find((r) => r.register !== spec.low_word_register);
    if (!low || !high) {
      throw new Error(`low_word_register ${spec.low_word_register} not among read registers [${regReadings.map((r) => r.register).join(",")}]`);
    }
    raw = (high.raw << 16) | low.raw;
    if (spec.signed) raw = toSigned(raw >>> 0, 32);
  } else {
    raw = regReadings[0]?.raw ?? 0;
    if (spec.signed) raw = toSigned(raw, 16);
  }

  let value = raw;
  if (typeof spec.offset === "number") value += spec.offset;
  if (typeof spec.scale === "number") value *= spec.scale;
  return value;
}

/**
 * Inverse of decode() — given an engineering value and the register(s) it
 * maps to, produces the raw register value(s) to write, in `registers`'
 * own order.
 * @param {number} value - the engineering value to write
 * @param {number[]} registers - address.registers
 * @param {object|null} decodeSpec - device_parameter_map.decode
 * @returns {{register: number, value: number}[]}
 */
export function encode(value, registers, decodeSpec) {
  const spec = decodeSpec ?? {};
  let raw = value;
  if (typeof spec.scale === "number" && spec.scale !== 0) raw = raw / spec.scale;
  if (typeof spec.offset === "number") raw -= spec.offset;
  raw = Math.round(raw);

  if (spec.combine === "low_high_word") {
    if (registers.length !== 2) {
      throw new Error(`low_high_word combine needs exactly 2 registers, got ${registers.length}`);
    }
    const unsigned32 = spec.signed ? toUnsigned(raw, 32) : raw >>> 0;
    const low = unsigned32 & 0xffff;
    const high = (unsigned32 >>> 16) & 0xffff;
    const lowRegister = spec.low_word_register ?? registers[0];
    return registers.map((register) => ({ register, value: register === lowRegister ? low : high }));
  }

  const word = spec.signed ? toUnsigned(raw, 16) : raw & 0xffff;
  return [{ register: registers[0], value: word }];
}
