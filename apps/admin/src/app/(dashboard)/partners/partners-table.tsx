"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Handshake, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ToneBadge, type Tone } from "@/components/page-kit";
import { PARTNER_SERVICE_LABEL, PARTNER_STATUSES, PARTNER_STATUS_LABEL } from "@/lib/partners";
import { cn } from "@/lib/utils";

export interface PartnerRow {
  id: string;
  company_name: string;
  contact_name: string;
  phone: string;
  email: string;
  states: string[];
  services: string[];
  status: string;
  created_at: string;
}

const TONES: Record<string, Tone> = { new: "info", in_review: "warn", approved: "good", rejected: "neutral" };

/** Where an installer works, kept short for a table cell: the first two states, then how many more. */
function statesLabel(states: string[]): string {
  if (states.length === 0) return "—";
  if (states.length <= 2) return states.join(", ");
  return `${states.slice(0, 2).join(", ")} +${states.length - 2}`;
}

/** The partner applications: search them, filter by status (each pill says how many), and open one. */
export function PartnersTable({ partners }: { partners: PartnerRow[] }) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("all");

  const counts = React.useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of partners) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [partners]);

  const q = search.trim().toLowerCase();
  const shown = partners.filter(
    (p) => (status === "all" || p.status === status) && (!q || [p.company_name, p.contact_name, p.email, p.phone, ...p.states].some((f) => f.toLowerCase().includes(q)))
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search company, contact, state…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-72 pl-8" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["all", ...PARTNER_STATUSES] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                status === s ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {s === "all" ? "All" : PARTNER_STATUS_LABEL[s]}
              <span className={cn("text-xs tabular-nums", status === s ? "opacity-80" : "opacity-60")}>{s === "all" ? partners.length : (counts[s] ?? 0)}</span>
            </button>
          ))}
        </div>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        {shown.length === 0 ? (
          <EmptyState
            icon={Handshake}
            title={partners.length === 0 ? "No applications yet" : "No applications match"}
            description={partners.length === 0 ? "Installers who apply from the Partner page appear here." : "Try another search or status."}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Works in</TableHead>
                <TableHead>Does</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((p) => (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => router.push(`/partners/${p.id}`)}>
                  <TableCell>
                    <Link href={`/partners/${p.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                      {p.company_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <div>{p.contact_name}</div>
                    <div className="text-xs">{p.phone}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{statesLabel(p.states)}</TableCell>
                  <TableCell className="max-w-56 text-muted-foreground">{p.services.map((s) => PARTNER_SERVICE_LABEL[s] ?? s).join(", ") || "—"}</TableCell>
                  <TableCell>
                    <ToneBadge tone={TONES[p.status] ?? "neutral"}>{PARTNER_STATUS_LABEL[p.status] ?? p.status}</ToneBadge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{new Date(p.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
