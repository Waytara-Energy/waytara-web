"use client";

import * as React from "react";
import { EvCharger, Server } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const KINDS = {
  solar: { label: "Inverter", icon: Server, active: "data-[state=active]:border-primary data-[state=active]:text-primary" },
  ev: { label: "EV Charger", icon: EvCharger, active: "data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400" },
} as const;

/** A site's inverter and its charger on one Maintenance page: a tab for each, with that device's own Health and Service underneath. The open tab
 *  is plain state (the address keeps the Health / Service tab of the device shown). */
export function MaintenanceDevices({ tabs, defaultKind }: { tabs: { kind: keyof typeof KINDS; content: React.ReactNode }[]; defaultKind: keyof typeof KINDS }) {
  const [value, setValue] = React.useState<string>(tabs.some((t) => t.kind === defaultKind) ? defaultKind : tabs[0].kind);
  return (
    <Tabs value={value} onValueChange={setValue}>
      <TabsList variant="line">
        {tabs.map((t) => {
          const k = KINDS[t.kind];
          return (
            <TabsTrigger key={t.kind} value={t.kind} variant="line" className={k.active}>
              <k.icon className="size-4 shrink-0 group-data-[state=active]:hidden" />
              <span className="text-sm font-medium">{k.label}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent key={t.kind} value={t.kind} className="mt-4 outline-none">
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
