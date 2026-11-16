"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@waytara/ui/cn";
import { Input } from "@/components/ui/input";
import { PARTNER_STATUS_LABEL, PARTNER_TYPE_LABEL } from "@/lib/partners";

export interface BoardPartner {
  id: string;
  company_name: string;
  contact_name: string;
  phone: string;
  email: string;
  status: string;
  partner_type: string | null;
  reference: string | null;
  created_at: string;
  updated_at: string;
  has_account: boolean;
}

type Tab = "needs" | "progress" | "approved" | "declined" | "all";

const NEEDS = ["new", "verification"];
const PROGRESS = ["in_review", "shortlisted", "onboarding"];
const DAY = 86_400_000;

function ago(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} min`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86_400)} d`;
}

/** What the team should do with it, in a few words, or what it is waiting for. */
function hint(p: BoardPartner, now: number): { text: string; tone: "act" | "wait" | "calm" } {
  const idle = Math.floor((now - Date.parse(p.updated_at)) / DAY);
  switch (p.status) {
    case "new":
      return { text: "Not looked at yet", tone: "act" };
    case "verification":
      return { text: "Sent for verification: ready to check", tone: "act" };
    case "in_review":
      return { text: "Screening", tone: "calm" };
    case "shortlisted":
      return { text: idle >= 3 ? `Shortlisted, onboarding not opened for ${idle} days` : "Shortlisted", tone: idle >= 3 ? "wait" : "calm" };
    case "onboarding":
      return { text: idle >= 3 ? `Waiting for them, no activity for ${idle} days` : "Waiting for them to send their details", tone: idle >= 3 ? "wait" : "calm" };
    case "approved":
      return { text: p.has_account ? "Approved, signed in" : "Approved, has not created their account", tone: p.has_account ? "calm" : "wait" };
    default:
      return { text: "Declined", tone: "calm" };
  }
}

/** The applications, on the left of the Partners page: what needs you, what is in progress, approved, declined and all. The open one is marked. Live: a new
 *  application or a change shows without a reload (the dashboard layout refreshes this page when the table changes). */
export function PartnersBoard({ partners }: { partners: BoardPartner[] }) {
  const openId = usePathname().match(/\/partners\/([0-9a-f-]{36})/)?.[1] ?? null;
  // Starts on the tab the open application is in; otherwise on what needs the team, or on All when nothing does.
  const [tab, setTab] = React.useState<Tab>(() => {
    const open = partners.find((p) => p.id === openId);
    if (open) return NEEDS.includes(open.status) ? "needs" : PROGRESS.includes(open.status) ? "progress" : open.status === "approved" ? "approved" : "declined";
    return partners.some((p) => NEEDS.includes(p.status)) ? "needs" : "all";
  });
  const [query, setQuery] = React.useState("");
  const [now] = React.useState(() => Date.now());

  const inTab = React.useCallback((p: BoardPartner, t: Tab) => (t === "needs" ? NEEDS.includes(p.status) : t === "progress" ? PROGRESS.includes(p.status) : t === "approved" ? p.status === "approved" : t === "declined" ? p.status === "rejected" : true), []);
  const counts = React.useMemo(() => ({ needs: partners.filter((p) => inTab(p, "needs")).length, progress: partners.filter((p) => inTab(p, "progress")).length, approved: partners.filter((p) => inTab(p, "approved")).length, declined: partners.filter((p) => inTab(p, "declined")).length, all: partners.length }), [partners, inTab]);

  const shown = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return partners.filter((p) => inTab(p, tab)).filter((p) => !q || `${p.company_name} ${p.contact_name} ${p.reference ?? ""} ${p.phone} ${p.email}`.toLowerCase().includes(q));
  }, [partners, tab, query, inTab]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "needs", label: "Needs you" },
    { id: "progress", label: "In progress" },
    { id: "approved", label: "Approved" },
    { id: "declined", label: "Declined" },
    { id: "all", label: "All" },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 rounded-xl border bg-card p-4 shadow-xs">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Partners</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Everyone who applied to the Partner Network.</p>
      </div>

      <div role="tablist" aria-label="Applications" className="grid grid-cols-5 gap-1 rounded-lg bg-muted p-1">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn("flex flex-col items-center justify-center rounded-md px-1 py-1.5 text-[11px] font-medium leading-tight transition-colors", tab === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            {t.label}
            <span className={cn("text-xs", t.id === "needs" && counts.needs > 0 ? "font-semibold text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>{counts[t.id]}</span>
          </button>
        ))}
      </div>

      <label className="relative block">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, reference, phone" aria-label="Search applications" className="pl-8" />
      </label>

      {shown.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
          {query ? "No application matches that." : tab === "needs" ? "Nothing is waiting for you." : tab === "progress" ? "Nothing is in progress." : tab === "approved" ? "No approved partners yet." : tab === "declined" ? "No declined applications." : "No applications yet."}
        </div>
      ) : (
        <ul className="-mx-1 min-h-0 flex-1 space-y-1 overflow-y-auto px-1 max-lg:overflow-visible">
          {shown.map((p) => {
            const h = hint(p, now);
            const open = p.id === openId;
            const act = NEEDS.includes(p.status);
            return (
              <li key={p.id}>
                <Link href={`/partners/${p.id}`} aria-current={open ? "page" : undefined} className={cn("block rounded-xl px-3.5 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", open ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-accent/60")}>
                  <div className="flex items-center justify-between gap-3">
                    <p className={cn("flex min-w-0 items-center gap-2 text-sm", act ? "font-semibold" : "font-medium")}>
                      {act && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Needs you" />}
                      <span className="truncate">{p.company_name}</span>
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground">{ago(p.created_at, now)}</span>
                  </div>
                  <p className={cn("mt-1 text-[13px] leading-snug", h.tone === "act" ? "font-medium text-foreground" : h.tone === "wait" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>{h.text}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium text-foreground">{PARTNER_STATUS_LABEL[p.status] ?? p.status}</span>
                    <span>{PARTNER_TYPE_LABEL[p.partner_type ?? ""] ?? "Partner"}</span>
                    {p.reference && <span className="font-mono">· {p.reference}</span>}
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{p.contact_name}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
