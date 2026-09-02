import { Sun } from "lucide-react";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { createClient } from "@waytara/supabase/server";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PROPERTY_TYPE_LABELS, POWER_SOURCE_LABELS } from "@/lib/site-catalog";

export default async function SitesPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: customer } = profile
    ? await supabase.from("customers").select("plan:plans(max_devices)").eq("id", profile.id).maybeSingle()
    : { data: null };

  const maxDevices = customer?.plan?.max_devices ?? null;

  const { data: sites } = await supabase
    .from("sites")
    .select("id, name, property_type, power_source_category")
    .order("created_at", { ascending: false });

  const { data: devices } = await supabase
    .from("devices")
    .select(
      "id, site_id, device_uid, label, status, device_type:device_types(name, device_type_instruments(instrument_name, unit, is_required))"
    )
    .order("created_at", { ascending: false });

  const totalDevices = devices?.length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Sites &amp; Devices</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {totalDevices} device{totalDevices === 1 ? "" : "s"}
          {maxDevices !== null ? ` of ${maxDevices} included on your plan` : ""}
        </p>
      </div>

      {!sites || sites.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Sun />
            </EmptyMedia>
            <EmptyTitle>No sites yet</EmptyTitle>
            <EmptyDescription>Your WayTara advisor sets this up during installation.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Accordion type="multiple" defaultValue={sites.map((s) => s.id)} className="rounded-xl border border-border bg-card px-4">
          {sites.map((site) => {
            const siteDevices = devices?.filter((d) => d.site_id === site.id) ?? [];
            return (
              <AccordionItem key={site.id} value={site.id}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex flex-col items-start gap-0.5">
                    <span className="text-base font-semibold text-foreground">{site.name}</span>
                    <span className="text-xs font-normal capitalize text-muted-foreground">
                      {PROPERTY_TYPE_LABELS[site.property_type] ?? site.property_type} ·{" "}
                      {POWER_SOURCE_LABELS[site.power_source_category] ?? site.power_source_category}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {siteDevices.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No devices at this site yet.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Device</TableHead>
                          <TableHead>ID</TableHead>
                          <TableHead className="text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {siteDevices.map((d) => {
                          const instruments = d.device_type?.device_type_instruments ?? [];
                          return (
                            <TableRow key={d.id}>
                              <TableCell className="font-medium text-foreground">
                                {instruments.length > 0 ? (
                                  <HoverCard>
                                    <HoverCardTrigger className="cursor-default underline decoration-dotted decoration-muted-foreground underline-offset-4">
                                      {d.device_type?.name ?? "Device"}
                                    </HoverCardTrigger>
                                    <HoverCardContent className="w-72">
                                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        Instruments
                                      </p>
                                      <ul className="mt-2 space-y-1 text-sm text-foreground">
                                        {instruments.map((i) => (
                                          <li key={i.instrument_name}>
                                            {i.instrument_name}
                                            {i.unit ? ` (${i.unit})` : ""}
                                            {i.is_required ? " *" : ""}
                                          </li>
                                        ))}
                                      </ul>
                                      <p className="mt-2 text-xs text-muted-foreground">* required</p>
                                    </HoverCardContent>
                                  </HoverCard>
                                ) : (
                                  (d.device_type?.name ?? "Device")
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground">{d.label || d.device_uid}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant={d.status === "active" ? "default" : "secondary"} className="capitalize">
                                  {d.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
