"use client";

import * as React from "react";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";
import { TN_DISTRICTS } from "@/lib/partner-network";

const OPTIONS: MultiSelectOption[] = TN_DISTRICTS.map((d) => ({ value: d, label: d }));

/** The districts a partner covers, chosen from the list. Inside a form it submits each one as a `district` field, so a server action can read them with getAll. */
export function DistrictsField({ id, initial }: { id: string; initial: string[] }) {
  const [value, setValue] = React.useState<string[]>(initial);
  return (
    <>
      <MultiSelect id={id} options={OPTIONS} value={value} onChange={setValue} placeholder="Choose districts" searchPlaceholder="Search districts" emptyText="No district found." />
      {value.map((d) => (
        <input key={d} type="hidden" name="district" value={d} />
      ))}
    </>
  );
}
