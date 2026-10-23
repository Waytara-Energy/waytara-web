import { Skeleton } from "@/components/ui/skeleton";

/** The quotation page: the title and who it is for, the pricing card (lines, subtotal, GST, total) and the buttons to answer it. */
export default function Loading() {
  return (
    <div className="fluid-container flex min-h-screen items-center justify-center py-16">
      <div className="w-full max-w-lg space-y-6">
        <div className="space-y-2 text-center">
          <Skeleton className="mx-auto h-7 w-64 max-w-full" />
          <Skeleton className="mx-auto h-4 w-72 max-w-full" />
        </div>
        <div className="space-y-4 rounded-xl border border-border bg-card p-5">
          <Skeleton className="h-4 w-44" />
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <Skeleton className="h-4 w-48 max-w-[60%]" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
          <div className="space-y-2 border-t border-border pt-4">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex justify-between border-t border-border pt-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
