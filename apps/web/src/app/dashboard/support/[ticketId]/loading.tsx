import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex h-[75vh] min-h-[420px] max-w-2xl flex-col rounded-xl border border-theme-border">
      <div className="flex items-center gap-3 border-b border-theme-border p-4">
        <Skeleton className="size-9 shrink-0 rounded-lg" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <div className="flex-1 space-y-4 p-4">
        <Skeleton className="ml-auto h-12 w-2/3 rounded-2xl" />
        <Skeleton className="h-16 w-3/4 rounded-2xl" />
        <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
      </div>
      <div className="border-t border-theme-border p-4">
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </div>
  );
}
