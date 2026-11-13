"use client";

import * as React from "react";
import { Loader2, Power } from "lucide-react";
import { cn } from "@/lib/utils";

const PAD = 4; // the thumb's distance from the track's edge, px
const THUMB = 40; // the thumb's size, px
const DONE = 0.82; // how far it must be taken for it to count

/**
 * A slide-to-confirm control: take the power button across the track to confirm (Start or Stop a charge). The words on the track say what is being
 * confirmed, in a short line and a smaller one under it. Letting go before the end sends the thumb back; while `busy` it waits at the end with a
 * spinner and returns when `busy` ends (the request failed, or the control changes to the other action). Without a pointer: Enter or Space on the
 * thumb confirms. `touch-action: none` on the thumb keeps a drag from scrolling the page, and `data-no-swipe` keeps it from being taken as a swipe to the next tab.
 */
export function SlideToConfirm({
  tone,
  label,
  hint,
  busy = false,
  disabled = false,
  onConfirm,
  ariaLabel,
  className,
}: {
  tone: "start" | "stop";
  label: string;
  hint?: string;
  busy?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  ariaLabel: string;
  className?: string;
}) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [trackW, setTrackW] = React.useState(240);
  React.useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const watcher = new ResizeObserver(() => setTrackW(el.clientWidth));
    watcher.observe(el);
    return () => watcher.disconnect();
  }, []);
  const max = Math.max(1, trackW - THUMB - PAD * 2);

  // where the thumb is while it is dragged (or has been taken to the end)
  const [pos, setPos] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const drag = React.useRef({ startX: 0, startPos: 0 });
  const [taken, setTaken] = React.useState(false);

  // Back at the start when the request ends or the control turns into the other action (done while rendering, from what the props were).
  const [seen, setSeen] = React.useState({ busy, tone });
  if (seen.busy !== busy || seen.tone !== tone) {
    setSeen({ busy, tone });
    if (!busy || seen.tone !== tone) {
      setTaken(false);
      setPos(0);
    }
  }
  // (if nothing started after the confirmation, it does not stay at the end)
  React.useEffect(() => {
    if (!taken || busy) return;
    const t = window.setTimeout(() => {
      setTaken(false);
      setPos(0);
    }, 1800);
    return () => window.clearTimeout(t);
  }, [taken, busy]);
  const x = busy && taken ? max : pos;

  const confirm = () => {
    setTaken(true);
    setPos(max);
    onConfirm();
  };

  const onDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || busy) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startPos: x };
    setDragging(true);
  };
  const onMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging) return;
    setPos(Math.min(max, Math.max(0, drag.current.startPos + e.clientX - drag.current.startX)));
  };
  const onUp = () => {
    if (!dragging) return;
    setDragging(false);
    if (pos >= max * DONE) confirm();
    else setPos(0);
  };
  const onKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || busy) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      confirm();
    }
  };

  const progress = Math.min(1, x / max);
  const look = disabled
    ? { track: "bg-muted text-muted-foreground/70", fill: "", thumb: "bg-muted-foreground/25 text-muted-foreground" }
    : tone === "stop"
      ? { track: "bg-red-500/10 text-red-600 ring-1 ring-inset ring-red-500/40 dark:text-red-400", fill: "bg-red-500/25", thumb: "bg-red-500 text-white" }
      : { track: "bg-emerald-500/15 text-emerald-700 ring-1 ring-inset ring-emerald-500/40 dark:text-emerald-400", fill: "bg-emerald-500/25", thumb: "bg-emerald-500 text-white" };

  return (
    <div ref={trackRef} data-no-swipe="true" className={cn("relative h-12 select-none overflow-hidden rounded-2xl", look.track, className)}>
      {/* what has been taken so far (nothing at rest) */}
      <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 rounded-2xl", look.fill, !dragging && "transition-[width] duration-300")} style={{ width: x > 0 ? x + THUMB + PAD * 2 : 0 }} />
      {/* the words: fade as the thumb comes over them */}
      <span aria-live="polite" className="pointer-events-none absolute inset-y-0 right-3 left-[3.75rem] flex flex-col items-center justify-center text-center leading-tight transition-opacity" style={{ opacity: Math.max(0, 1 - progress * 1.4) }}>
        <span className="max-w-full truncate text-[13px] font-semibold">{label}</span>
        {hint ? <span className="max-w-full truncate text-[10.5px] font-normal opacity-80">{hint}</span> : null}
      </span>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-disabled={disabled || busy}
        disabled={disabled}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
        className={cn(
          "absolute top-1 left-1 grid size-10 touch-none place-items-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          tone === "stop" ? "focus-visible:ring-red-500" : "focus-visible:ring-emerald-500",
          look.thumb,
          dragging ? "cursor-grabbing" : disabled ? "cursor-not-allowed" : "cursor-grab",
          !dragging && "transition-transform duration-300 ease-out"
        )}
        style={{ transform: `translateX(${x}px)` }}
      >
        {busy ? <Loader2 className="size-5 animate-spin" /> : <Power className="size-5" strokeWidth={2.25} />}
      </button>
    </div>
  );
}
