"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** The Support page's frame: the ticket list on the left, and on the right whatever is open (a conversation, or the help). On a wide screen both
 *  are always there and the page does not scroll as a whole. On a phone the list is the first screen; opening a ticket shows only the
 *  conversation (it has a back button) and the list comes back with it. */
export function SupportShell({ list, children }: { list: React.ReactNode; children: React.ReactNode }) {
  const inTicket = /\/dashboard\/support\/[0-9a-f-]{36}/.test(usePathname());
  return (
    <div className={cn("grid gap-4 lg:h-[calc(100svh-7rem)] lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)]", inTicket ? "h-[calc(100svh-6.5rem)]" : "")}>
      <aside className={cn("flex min-h-0 flex-col", inTicket && "max-lg:hidden")}>{list}</aside>
      <section className="min-h-0 min-w-0">{children}</section>
    </div>
  );
}
