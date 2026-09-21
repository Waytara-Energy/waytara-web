"use client";

import { useEffect, useState } from "react";
import { Tabs } from "@/components/ui/tabs";

/** Wraps the Tabs primitive with the one thing an uncontrolled `<Tabs
 *  defaultValue>` can't do on its own: honoring an incoming #hash (e.g. an
 *  Overview card's deep-link into a specific node) as the starting tab.
 *  The server has no access to location.hash, so this renders
 *  `defaultValue` for SSR/first paint and switches right after mount if a
 *  hash is present, rather than guessing it server-side. Keeps the hash in
 *  sync on every tab change too, so a reload or a copied link lands back
 *  on the same tab instead of resetting to the first one. */
export function MonitoringTabs({ defaultValue, children }: { defaultValue: string; children: React.ReactNode }) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) setValue(hash);
  }, []);

  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        setValue(next);
        history.replaceState(null, "", `#${next}`);
      }}
    >
      {children}
    </Tabs>
  );
}
