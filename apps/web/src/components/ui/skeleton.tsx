import { cn } from "@/lib/utils"

/** Placeholder block with a diagonal shimmer sweep (pure CSS, so it runs
 *  before hydration and ships no JavaScript). `overflow-hidden` clips the
 *  sweep to the block's own rounded shape; the sweep is disabled for users
 *  who ask for reduced motion. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("relative overflow-hidden rounded-md bg-accent", className)}
      {...props}
    >
      <div className="animate-skeleton-shimmer absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent dark:via-white/10" />
    </div>
  )
}

export { Skeleton }
