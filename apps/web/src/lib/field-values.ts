import type { EnumOption } from "./enum-labels";
import type { FieldValue } from "./template-field-format";

/** The server's current value of each field, as plain data a client component can take as a prop. */
/** A reading that is actually a record: reported, and not empty or zero (an alarm word of 0 says only that nothing is wrong). */
export function hasRecord(v: FieldValue | undefined): boolean {
  return v !== null && v !== undefined && v !== "" && v !== 0;
}

export function valuesFor(fields: { key: string }[], get: (key: string) => FieldValue): Record<string, FieldValue> {
  return Object.fromEntries(fields.map((f) => [f.key, get(f.key)]));
}

/** A Map of enum options as a plain object (Maps are not safe to pass as props everywhere). */
export function enumToObject(options: Map<string, EnumOption[]> | undefined): Record<string, EnumOption[]> | undefined {
  return options ? Object.fromEntries(options) : undefined;
}
