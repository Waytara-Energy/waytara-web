"use client";

import * as React from "react";
import { createPortal } from "react-dom";

const HOST = '[data-slot="sidebar-inset"]';
const subscribe = () => () => undefined;

/**
 * The picture or colour behind the Overview. It is painted over the whole content area of the page (the dashboard's SidebarInset, behind
 * the header too, which turns transparent while this is on screen) and not inside the board, so it covers the screen edge to edge. The
 * SidebarInset is `isolate`d in the dashboard layout so this layer (z-index -10) sits above its own background and below everything else.
 */
export function OverviewBackdrop({ css }: { css: string }) {
  // the element to paint into is found once the page is in the browser (nothing during the server render)
  const host = React.useSyncExternalStore(subscribe, () => document.querySelector(HOST), () => null);
  if (!host) return null;
  return createPortal(
    <>
      <style>{`${HOST} > header{background:transparent!important}${HOST} > header::after{display:none}`}</style>
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{ background: css }} />
    </>,
    host,
  );
}
