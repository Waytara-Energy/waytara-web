"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

/** Base pulse (CSS, works even if JS hasn't hydrated yet) plus a diagonal
 *  shimmer sweep on top (framer-motion, infinite loop) — the pulse alone
 *  reads as "stuck"; the sweep is what makes it feel alive without being
 *  distracting. `overflow-hidden` clips the sweep to the block's own
 *  rounded shape. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("relative overflow-hidden rounded-md bg-accent", className)}
      {...props}
    >
      <motion.div
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent dark:via-white/10"
        animate={{ x: ["-100%", "100%"] }}
        transition={{ repeat: Infinity, duration: 1.6, ease: "linear" }}
      />
    </div>
  )
}

export { Skeleton }
