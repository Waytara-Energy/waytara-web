"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Cpu, Home, MapPin, Rocket } from "lucide-react";
import { withPromiseToast } from "@waytara/ui/notify";
import { START_PAGES, type StartPageId } from "@/lib/start-page";
import { cn } from "@/lib/utils";
import { saveDefaultSite, saveStartPage } from "@/app/dashboard/settings/account-actions";
import { OverviewSection } from "./overview-section";
import { SettingsCard, TwoColumns } from "./settings-card";
import type { ComponentProps } from "react";

export interface DashboardSite {
  id: string;
  name: string;
  devices: number;
  address: string | null;
}

export interface DashboardProps {
  startPage: StartPageId;
  sites: DashboardSite[];
  selectedSiteId: string | null;
  overview: ComponentProps<typeof OverviewSection>;
}

/** Settings > Dashboard: where the dashboard opens, which site it shows, and (below) what the Overview shows: four cards and a background. */
export function DashboardSection({ startPage, sites, selectedSiteId, overview }: DashboardProps) {
  const router = useRouter();
  const [start, setStart] = React.useState<StartPageId>(startPage);
  const [site, setSite] = React.useState<string | null>(selectedSiteId);

  async function pickStart(id: StartPageId) {
    const before = start;
    setStart(id);
    const ok = await withPromiseToast(saveStartPage, { loading: "Saving…", success: "The dashboard will open there." })(id);
    if (!ok) setStart(before);
  }

  async function pickSite(id: string) {
    const before = site;
    setSite(id);
    const ok = await withPromiseToast(saveDefaultSite, { loading: "Switching…", success: "Site switched." })(id);
    if (ok) router.refresh();
    else setSite(before);
  }

  return (
    <div className="space-y-5">
      <TwoColumns
        left={
        <SettingsCard title="Start page" description="The page the dashboard opens on when you sign in." icon={Rocket} tone="amber">
          <div role="radiogroup" aria-label="Start page" className="grid gap-2 sm:grid-cols-2">
            {START_PAGES.map((p) => {
              const on = start === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => void pickStart(p.id)}
                  className={cn("flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", on ? "border-primary bg-primary/10" : "border-border hover:bg-accent")}
                >
                  <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border", on ? "border-primary" : "border-muted-foreground/40")}>{on && <span className="size-2 rounded-full bg-primary" />}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{p.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{p.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </SettingsCard>
        }
        right={
        <SettingsCard title="Site" description={sites.length > 1 ? "Which of your sites the dashboard shows. You can also switch from the header." : "The site the dashboard shows."} icon={MapPin} tone="teal">
          {sites.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">Your WayTara advisor adds your site during installation.</p>
          ) : (
            <div role="radiogroup" aria-label="Site" className="space-y-2">
              {sites.map((s) => {
                const on = (site ?? sites[0].id) === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => void pickSite(s.id)}
                    className={cn("flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", on ? "border-primary bg-primary/10" : "border-border hover:bg-accent")}
                  >
                    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", on ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
                      <Home className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{s.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{s.address ?? "No address yet"}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      <Cpu className="size-3.5" />
                      {s.devices}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </SettingsCard>
        }
      />

      <OverviewSection {...overview} />
    </div>
  );
}
