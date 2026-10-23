import { cn } from "@waytara/ui/cn";

/** A placeholder block with a diagonal shimmer sweep (pure CSS). `overflow-hidden` clips the sweep to the block's own rounded shape. */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="skeleton" className={cn("relative overflow-hidden rounded-md bg-accent", className)} {...props}>
      <div className="animate-skeleton-shimmer absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent dark:via-white/10" />
    </div>
  );
}
