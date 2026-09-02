"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** A bare spinning icon — for places that already manage their own layout
 *  (e.g. a full-page/section loading state) and just need the mark. */
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin", className)} aria-hidden="true" />;
}

/** The inline version for buttons: animates its own width in/out so the
 *  button doesn't just hard-cut between "icon, text" and "text" layouts —
 *  it grows a little room for the spinner, then collapses it away, so the
 *  request-in-flight state reads as a transition, not a flicker. Render
 *  unconditionally inside a button and pass `show` — nothing renders (and
 *  no button padding is added) when `show` is false. */
export function ButtonSpinner({ show, className }: { show: boolean; className?: string }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.span
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: "1rem", opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className={cn("inline-flex shrink-0 items-center overflow-hidden", className)}
        >
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
        </motion.span>
      )}
    </AnimatePresence>
  );
}
