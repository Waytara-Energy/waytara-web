import { Skeleton } from "@/components/ui/skeleton";

/** Onboarding status: the title and its line, then the card for the stage the customer is at (the steps, and what to do next). */
export default function Loading() {
  return (
    <div className="max-w-xl space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <div className="space-y-4 rounded-xl border border-border bg-card p-5">
        <Skeleton className="h-4 w-40" />
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-6 shrink-0 rounded-full" />
              <Skeleton className="h-4 w-48 max-w-full" />
            </div>
          ))}
        </div>
        <Skeleton className="h-10 w-40 rounded-xl" />
      </div>
    </div>
  );
}
