"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface QueryFilter {
  /** the search parameter */
  key: string;
  /** what "no filter" reads as, e.g. "All sources" */
  all: string;
  options: { value: string; label: string }[];
  width?: string;
}

/** Dropdown filters that live in the page's address (?source=hub): choosing one reloads the page filtered on the server, and a link to it keeps the filter. */
export function QueryFilters({ filters }: { filters: QueryFilter[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = React.useTransition();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === "all") next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-busy={pending}>
      {filters.map((f) => (
        <Select key={f.key} value={params.get(f.key) ?? "all"} onValueChange={(v) => set(f.key, v)}>
          <SelectTrigger className={f.width ?? "w-48"} aria-label={f.all}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{f.all}</SelectItem>
            {f.options.map((o) => (
              <SelectItem key={o.value} value={o.value} className="capitalize">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
    </div>
  );
}
