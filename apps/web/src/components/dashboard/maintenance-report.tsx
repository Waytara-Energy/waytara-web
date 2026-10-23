"use client";

import Link from "next/link";
import { CheckCircle2, LifeBuoy, TriangleAlert, XCircle, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { alreadyReported, type CheckState } from "@/lib/maintenance-health";

/** Where a report is filed: the device and site the page is about. */
export interface ReportTarget {
  deviceId: string;
  deviceLabel: string;
  siteId: string;
  siteName: string | null;
}

export const CHECK_ICON: Record<CheckState, { Icon: LucideIcon; className: string }> = {
  ok: { Icon: CheckCircle2, className: "text-emerald-500" },
  warn: { Icon: TriangleAlert, className: "text-amber-500" },
  bad: { Icon: XCircle, className: "text-destructive" },
};

/** A link to Support for something the page has shown: it opens the new-ticket form with the device, subject and message filled in, so the
 *  customer only has to read it and send. While a ticket about it is open it says so instead. */
export function ReportButton({ report, tag, subject, text, openIssues, label }: { report: ReportTarget; tag: string; subject: string; text: string; openIssues: string[]; label: string }) {
  if (alreadyReported(openIssues, tag)) {
    return (
      <Link href="/dashboard/support" className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
        <CheckCircle2 className="size-3.5 text-emerald-500" />
        In Support
      </Link>
    );
  }
  const href = `/dashboard/support?${new URLSearchParams({ new: "1", device: report.deviceId, category: "device", subject, message: text })}`;
  return (
    <Button asChild variant="outline" size="sm" className="h-7 shrink-0 gap-1.5 px-2.5 text-xs">
      <Link href={href}>
        <LifeBuoy className="size-3.5" />
        {label}
      </Link>
    </Button>
  );
}
