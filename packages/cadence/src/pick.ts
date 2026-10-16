// Choosing values to put in a file: grouping for the picker and searching it. Pure.

export interface CadenceKey {
  key: string;
  label: string;
  unit: string | null;
  group: string | null;
  cadence_s: number | null;
}

export interface KeyGroup {
  id: string;
  label: string;
  items: CadenceKey[];
}

const OTHER = "Other";

/** Groups in alphabetical order with "Other" last; within a group by name. */
export function groupKeys(keys: readonly CadenceKey[]): KeyGroup[] {
  const by = new Map<string, CadenceKey[]>();
  for (const k of keys) {
    const g = k.group?.trim() || OTHER;
    (by.get(g) ?? by.set(g, []).get(g)!).push(k);
  }
  return [...by.entries()]
    .sort(([a], [b]) => (a === OTHER ? 1 : b === OTHER ? -1 : a.localeCompare(b)))
    .map(([id, items]) => ({ id, label: id, items: items.slice().sort((x, y) => x.label.localeCompare(y.label)) }));
}

/** Keeps the keys whose name, key or group contains every word of the query. */
export function filterKeys(keys: readonly CadenceKey[], query: string): CadenceKey[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...keys];
  return keys.filter((k) => {
    const hay = `${k.label} ${k.key} ${k.group ?? ""} ${k.unit ?? ""}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

export const keyTitle = (k: Pick<CadenceKey, "label" | "unit">): string => (k.unit ? `${k.label} (${k.unit})` : k.label);

/** How often a value is read, in words: "every 5 seconds". */
export function cadenceText(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "";
  if (seconds < 60) return `every ${seconds} seconds`;
  if (seconds % 3600 === 0) return seconds === 3600 ? "every hour" : `every ${seconds / 3600} hours`;
  if (seconds % 60 === 0) return seconds === 60 ? "every minute" : `every ${seconds / 60} minutes`;
  return `every ${seconds} seconds`;
}
