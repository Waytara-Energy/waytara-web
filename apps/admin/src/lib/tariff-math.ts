// A copy of the bill rules in apps/web/src/lib/tariff-schedule.ts, only what the Electricity rates page needs: reading the slabs a staff
// member types, and the "typical" Rs per unit shown as a tariff's headline. Keep the two in step.

export interface Slab {
  upTo: number | null;
  rate: number;
}

/** "100 3.5" one band per line: the top of the band (units per bill), then the rate. A line with only a rate (or "-" / "above" as
 *  the top) is the last, open-ended band. Returns an error message instead of bands when a line cannot be read. */
export function parseSlabText(text: string): { slabs: Slab[] } | { error: string } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const slabs: Slab[] = [];
  for (const [i, line] of lines.entries()) {
    const parts = line.replace(/[₹,]/g, " ").split(/[\s:=-]+/).filter(Boolean);
    const nums = parts.filter((p) => !Number.isNaN(Number(p))).map(Number);
    const open = parts.length === 1 || parts.some((p) => /^(above|over|rest|more|open|\+)$/i.test(p));
    if (nums.length === 0) return { error: `Line ${i + 1} ("${line}") has no numbers.` };
    const rate = nums[nums.length - 1];
    const upTo = open || nums.length < 2 ? null : nums[nums.length - 2];
    if (rate < 0 || rate > 100) return { error: `Line ${i + 1}: the rate must be between 0 and 100.` };
    if (upTo !== null && upTo <= 0) return { error: `Line ${i + 1}: the top of a band must be above 0.` };
    slabs.push({ upTo, rate });
  }
  for (let i = 0; i < slabs.length; i += 1) {
    const last = i === slabs.length - 1;
    if (last && slabs[i].upTo !== null) return { error: "The last line must be the open-ended band (just its rate, e.g. \"9.75\")." };
    if (!last && slabs[i].upTo === null) return { error: "Only the last line can be open-ended." };
    if (!last && i > 0 && (slabs[i].upTo as number) <= (slabs[i - 1].upTo as number)) return { error: "The bands must go up: each top must be above the one before." };
  }
  return { slabs };
}

function slabCharge(slabs: Slab[], units: number): number {
  let remaining = Math.max(0, units);
  let from = 0;
  let total = 0;
  for (const s of slabs) {
    if (remaining <= 0) break;
    const width = s.upTo === null ? remaining : Math.min(remaining, s.upTo - from);
    if (width > 0) total += width * s.rate;
    remaining -= Math.max(width, 0);
    from = s.upTo ?? from;
  }
  return total;
}

/** Average Rs per unit at 250 units a month (free units left out), incl. surcharge and duty. */
export function typicalRate(input: { slabs: Slab[]; billingMonths: number; dutyPct: number; surchargePerKwh: number }, monthlyUnits = 250): number {
  const units = monthlyUnits * input.billingMonths;
  const energy = slabCharge(input.slabs, units) + units * input.surchargePerKwh;
  return (energy * (1 + input.dutyPct / 100)) / input.billingMonths / monthlyUnits;
}
