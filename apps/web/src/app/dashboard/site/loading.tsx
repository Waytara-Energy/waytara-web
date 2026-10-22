import { Skeleton } from "@/components/ui/skeleton";

/** The shape of the page: a full-page map with a card of icons and a card of details on the left. */
export default function Loading() {
  return (
    <div className="relative -mx-6 -mb-6 -mt-3 h-[calc(100svh-clamp(3.5rem,4.5vw,4.25rem))] min-h-[520px] overflow-hidden">
      <Skeleton className="absolute inset-0 rounded-none" />
      <div className="absolute inset-x-3 bottom-3 flex flex-col gap-3 md:bottom-auto md:left-4 md:right-auto md:top-4 md:w-[380px]">
        <Skeleton className="hidden h-28 rounded-2xl bg-card md:block" />
        <Skeleton className="h-64 rounded-2xl bg-card" />
      </div>
    </div>
  );
}
