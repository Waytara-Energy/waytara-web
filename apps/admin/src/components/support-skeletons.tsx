import { Skeleton } from "@/components/ui/skeleton";

// What the staff Support page shows while it loads: the ticket list on the left, and the guide or a conversation on the right.

export function InboxSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-3.5 w-48" />
      </div>
      <div className="grid grid-cols-3 gap-1">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-9 rounded-md" />
        ))}
      </div>
      <Skeleton className="h-9 w-full rounded-md" />
      <div className="space-y-1">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="space-y-2 rounded-lg px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-44 max-w-[70%]" />
              <Skeleton className="h-3 w-10" />
            </div>
            <Skeleton className="h-3.5 w-3/4" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The guide on the right while no ticket is open: a heading, a line, and the numbered cards. */
export function GuideSkeleton() {
  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-6">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-full max-w-xl" />
      <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2 rounded-lg border border-border p-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** An open ticket: the header with its status and buttons, the messages, the box to write in, and the details at the right. */
export function TicketSkeleton() {
  return (
    <div className="flex h-full min-h-0 gap-4">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="space-y-2">
            <Skeleton className="h-5 w-56 max-w-full" />
            <Skeleton className="h-3 w-44" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </header>
        <div className="flex-1 space-y-4 overflow-hidden p-4">
          <div className="flex items-end gap-2">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <Skeleton className="h-16 w-3/5 rounded-2xl" />
          </div>
          <Skeleton className="ml-auto h-12 w-1/2 rounded-2xl" />
          <div className="flex items-end gap-2">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <Skeleton className="h-20 w-2/3 rounded-2xl" />
          </div>
        </div>
        <div className="border-t border-border p-3">
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
      </section>
      <aside className="hidden w-72 shrink-0 space-y-4 xl:block">
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </aside>
    </div>
  );
}
