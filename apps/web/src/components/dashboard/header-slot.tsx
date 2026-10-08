"use client";

import * as React from "react";
import { createPortal } from "react-dom";

// A page can put its own controls into the dashboard header (Overview puts its status and Go Live there): the header renders a
// target element, and a page renders <HeaderSlot> with what it wants shown in it. The slot's element is kept in state by a
// callback ref, so the portal appears as soon as the header has mounted - no effect, no flash.
const SlotContext = React.createContext<{ element: HTMLElement | null; setElement: (el: HTMLElement | null) => void } | null>(null);

export function HeaderSlotProvider({ children }: { children: React.ReactNode }) {
  const [element, setElement] = React.useState<HTMLElement | null>(null);
  const value = React.useMemo(() => ({ element, setElement }), [element]);
  return <SlotContext.Provider value={value}>{children}</SlotContext.Provider>;
}

/** Where a page's header controls appear (rendered once, by the header). */
export function HeaderSlotTarget({ className }: { className?: string }) {
  const ctx = React.useContext(SlotContext);
  return <div ref={ctx?.setElement} className={className} />;
}

/** Shows `children` in the header, wherever this is rendered in the page. */
export function HeaderSlot({ children }: { children: React.ReactNode }) {
  const ctx = React.useContext(SlotContext);
  if (!ctx?.element) return null;
  return createPortal(children, ctx.element);
}
