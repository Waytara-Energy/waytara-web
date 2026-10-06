// Enum option helpers that are safe to import from client components (instrument-catalog-data.ts is server-only
// and re-exports these for its existing callers).

export interface EnumOption {
  code: string;
  label: string;
}

/** Resolves an enum code to its label (a bare "Code N" when the code is not in equipment_enum). */
export function lookupEnumLabel(options: Map<string, EnumOption[]>, enumRef: string, code: string | number | null): string | null {
  if (code === null) return null;
  const match = (options.get(enumRef) ?? []).find((o) => o.code === String(code));
  return match?.label ?? `Code ${code}`;
}
