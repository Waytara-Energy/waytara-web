"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@waytara/ui/cn";

/** The Support page's frame: the ticket list on the left, the open ticket (or a short guide) on the right. On a phone the list is the first
 *  screen and opening a ticket shows only the ticket (with its back button). */
export function SupportFrame({ list, children }: { list: React.ReactNode; children: React.ReactNode }) {
  const inTicket = /\/support\/[0-9a-f-]{36}/.test(usePathname());
  return (
    <div className={cn("grid gap-4 lg:h-[calc(100svh-8rem)] lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]", inTicket ? "h-[calc(100svh-8rem)]" : "")}>
      <aside className={cn("flex min-h-0 flex-col", inTicket && "max-lg:hidden")}>{list}</aside>
      <section className="min-h-0 min-w-0">{children}</section>
    </div>
  );
}
