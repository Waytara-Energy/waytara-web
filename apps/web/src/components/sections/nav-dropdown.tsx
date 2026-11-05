"use client";

import * as React from "react";

/**
 * The behaviour every header dropdown shares: it opens when the pointer enters or focus lands inside, stays open while the pointer crosses
 * the small gap to the panel, and closes on Escape, a click outside, leaving focus, or choosing a link. The panel is always a solid card,
 * so it reads the same over the hero and over a normal page. What goes in the trigger and the panel is up to the caller.
 */
export function NavDropdown({
  panelId,
  panelClassName,
  renderTrigger,
  renderPanel,
}: {
  panelId: string;
  /** Width and any extra classes for the panel card. */
  panelClassName: string;
  renderTrigger: (state: { open: boolean; toggle: () => void; panelId: string }) => React.ReactNode;
  renderPanel: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hoverOpened, setHoverOpened] = React.useState(false);

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  // A short delay so the pointer can cross the small gap between the trigger and the panel without the panel vanishing.
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };
  const close = () => setOpen(false);
  // With a mouse the pointer has already opened the panel by the time it clicks, so that click must not close it again.
  function handleToggle() {
    if (open && hoverOpened) setHoverOpened(false);
    else setOpen((v) => !v);
  }

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  React.useEffect(() => cancelClose, []);

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => {
        cancelClose();
        if (!open) setHoverOpened(true);
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
      onFocus={() => {
        cancelClose();
        setOpen(true);
      }}
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      {renderTrigger({ open, panelId, toggle: handleToggle })}

      {open && (
        <div id={panelId} className="absolute left-1/2 top-full z-50 -translate-x-1/2 pt-3">
          <div className={`overflow-hidden rounded-2xl border border-theme-border bg-theme-bg text-theme-primary shadow-xl ${panelClassName}`}>{renderPanel(close)}</div>
        </div>
      )}
    </div>
  );
}
