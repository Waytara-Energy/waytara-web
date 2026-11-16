"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@waytara/ui/cn";

/** The Partners page's frame, the same as Support's: the list of applications on the left, the open one (or a short guide) on the right. On a phone the list is the
 *  first screen, and opening an application shows only that application (with its back link). */
export function PartnersFrame({ list, children }: { list: React.ReactNode; children: React.ReactNode }) {
  const inPartner = /\/partners\/[0-9a-f-]{36}/.test(usePathname());
  return (
    <div className={cn("grid gap-4 lg:h-[calc(100svh-5.5rem)] lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]", inPartner ? "h-[calc(100svh-6rem)]" : "")}>
      <aside className={cn("flex min-h-0 flex-col", inPartner && "max-lg:hidden")}>{list}</aside>
      <section className="min-h-0 min-w-0 overflow-y-auto lg:pr-1">{children}</section>
    </div>
  );
}
