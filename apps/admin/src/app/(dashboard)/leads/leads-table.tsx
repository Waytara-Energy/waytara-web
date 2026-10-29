"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ToneBadge, type Tone } from "@/components/page-kit";
import { cn } from "@/lib/utils";

export interface LeadRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: string;
  source: string | null;
  created_at: string;
  assigned_to: string | null;
  accepted_at: string | null;
  assignee_name: string | null;
}

export const LEAD_STATUSES = ["new", "assigned", "quoted", "converted", "lost"] as const;

const TONES: Record<string, Tone> = { new: "info", assigned: "warn", quoted: "violet", converted: "good", lost: "neutral" };

/** The leads: search them, filter by status (each pill says how many), and open one. */
export function LeadsTable({ leads }: { leads: LeadRow[] }) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("all");

  const counts = React.useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of leads) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, [leads]);

  const q = search.trim().toLowerCase();
  const shown = leads.filter((l) => (status === "all" || l.status === status) && (!q || [l.full_name, l.email, l.phone, l.assignee_name, l.source].some((f) => f?.toLowerCase().includes(q))));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search name, email, phone…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-72 pl-8" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["all", ...LEAD_STATUSES] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium capitalize outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                status === s ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {s}
              <span className={cn("text-xs tabular-nums", status === s ? "opacity-80" : "opacity-60")}>{s === "all" ? leads.length : (counts[s] ?? 0)}</span>
            </button>
          ))}
        </div>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        {shown.length === 0 ? (
          <EmptyState icon={Users} title={leads.length === 0 ? "No leads yet" : "No leads match"} description={leads.length === 0 ? "Quote requests from the landing page appear here." : "Try another search or status."} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned to</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((lead) => (
                <TableRow key={lead.id} className="cursor-pointer" onClick={() => router.push(`/leads/${lead.id}`)}>
                  <TableCell>
                    <Link href={`/leads/${lead.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                      {lead.full_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <div>{lead.email}</div>
                    <div className="text-xs">{lead.phone}</div>
                  </TableCell>
                  <TableCell>
                    <ToneBadge tone={TONES[lead.status] ?? "neutral"} className="capitalize">
                      {lead.status}
                    </ToneBadge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {lead.assignee_name ?? "—"}
                      {lead.assigned_to ? <ToneBadge tone={lead.accepted_at ? "good" : "warn"}>{lead.accepted_at ? "In progress" : "Action needed"}</ToneBadge> : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{lead.source}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{new Date(lead.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
