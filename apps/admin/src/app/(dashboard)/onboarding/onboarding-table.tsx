"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ToneBadge, type Tone } from "@/components/page-kit";

export interface OnboardingRow {
  id: string;
  stage: string;
  updated_at: string;
  name: string | null;
  email: string | null;
}

/** The stages of the pipeline, in order, with how each reads and its colour. */
export const STAGES: { value: string; label: string; tone: Tone }[] = [
  { value: "quotation_sent", label: "Quotation sent", tone: "info" },
  { value: "quotation_accepted", label: "Quotation accepted", tone: "info" },
  { value: "payment_pending", label: "Payment pending", tone: "warn" },
  { value: "account_created", label: "Account created", tone: "violet" },
  { value: "site_setup", label: "Site setup", tone: "violet" },
  { value: "connection_test", label: "Connection test", tone: "violet" },
  { value: "install_scheduled", label: "Install scheduled", tone: "warn" },
  { value: "install_completed", label: "Install completed", tone: "good" },
];

/** Every customer moving through the pipeline: search, filter by stage, open one. */
export function OnboardingTable({ rows }: { rows: OnboardingRow[] }) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [stage, setStage] = React.useState("all");

  const q = search.trim().toLowerCase();
  const shown = rows.filter((r) => (stage === "all" || r.stage === stage) && (!q || [r.name, r.email].some((f) => f?.toLowerCase().includes(q))));
  const stageInfo = (v: string) => STAGES.find((s) => s.value === v);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search name or email…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-72 pl-8" />
        </div>
        <Select value={stage} onValueChange={setStage}>
          <SelectTrigger className="w-52" aria-label="Stage">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {STAGES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">
          {shown.length} of {rows.length}
        </span>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        {shown.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title={rows.length === 0 ? "No onboarding records yet" : "Nothing matches"} description={rows.length === 0 ? "They are created from a lead once a quotation goes out." : "Try another search or stage."} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Last updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((r) => {
                const info = stageInfo(r.stage);
                const step = STAGES.findIndex((s) => s.value === r.stage) + 1;
                return (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => router.push(`/onboarding/${r.id}`)}>
                    <TableCell>
                      <Link href={`/onboarding/${r.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                        {r.name ?? "Unknown lead"}
                      </Link>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </TableCell>
                    <TableCell>
                      <ToneBadge tone={info?.tone ?? "neutral"}>{info?.label ?? r.stage.replace(/_/g, " ")}</ToneBadge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                          <span className="block h-full rounded-full bg-primary" style={{ width: `${(step / STAGES.length) * 100}%` }} />
                        </span>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {step}/{STAGES.length}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{new Date(r.updated_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
