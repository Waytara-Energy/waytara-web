import type { EnumOption } from "./enum-labels";
import type { FieldValue } from "./template-field-format";

/** The server's current value of each field, as plain data a client component can take as a prop. */
export function valuesFor(fields: { key: string }[], get: (key: string) => FieldValue): Record<string, FieldValue> {
  return Object.fromEntries(fields.map((f) => [f.key, get(f.key)]));
}

/** A Map of enum options as a plain object (Maps are not safe to pass as props everywhere). */
export function enumToObject(options: Map<string, EnumOption[]> | undefined): Record<string, EnumOption[]> | undefined {
  return options ? Object.fromEntries(options) : undefined;
}
