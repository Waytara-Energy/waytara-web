import { Skeleton } from "@/components/ui/skeleton";

// What the Support page shows while it loads, piece by piece: the ticket list on the left (a layout, so it has its own), and on the right either
// the help or a conversation. They are used by the layout's Suspense and by the loading files of the two right-hand routes.

/** The ticket list: the title with its button, the Open / Closed switch and a few tickets. */
export function InboxSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-3.5 w-40" />
        </div>
        <Skeleton className="h-9 w-28 shrink-0 rounded-xl" />
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <div className="space-y-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2 rounded-xl px-3.5 py-3">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-44 max-w-[70%]" />
              <Skeleton className="h-3 w-10" />
            </div>
            <Skeleton className="h-3.5 w-full" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-3 w-14" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The right side while no ticket is open: the "How can we help?" card, then the common questions. */
export function HelpSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3.5 w-72 max-w-full" />
          </div>
        </div>
        <Skeleton className="mt-4 h-10 w-full rounded-lg" />
      </section>
      <section>
        <Skeleton className="mb-3 ml-1 h-4 w-36" />
        <div className="space-y-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-2xl" />
          ))}
        </div>
      </section>
    </div>
  );
}

/** A ticket's conversation: the header with its status, the messages, the box to write in, and (on a wide screen) the side cards. */
export function ConversationSkeleton() {
  return (
    <div className="flex h-full min-h-0 gap-4">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card">
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="space-y-2">
            <Skeleton className="h-5 w-56 max-w-full" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-6 w-20 shrink-0 rounded-full" />
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
          <Skeleton className="ml-auto h-10 w-2/5 rounded-2xl" />
        </div>
        <div className="border-t border-border p-3">
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </section>
      <aside className="hidden w-72 shrink-0 space-y-4 xl:block">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </aside>
    </div>
  );
}
