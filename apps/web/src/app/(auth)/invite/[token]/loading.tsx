import { Skeleton } from "@/components/ui/skeleton";

/** The invitation page: the title, then the form (name, e-mail, phone, address, password) and its button. */
export default function Loading() {
  return (
    <div className="fluid-container flex min-h-screen items-center justify-center py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <Skeleton className="mx-auto h-7 w-64 max-w-full" />
          <Skeleton className="mx-auto h-4 w-72 max-w-full" />
        </div>
        <div className="space-y-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
