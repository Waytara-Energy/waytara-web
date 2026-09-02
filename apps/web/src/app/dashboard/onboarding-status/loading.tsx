import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-md space-y-4 pt-12 text-center">
      <Skeleton className="mx-auto h-6 w-64" />
      <Skeleton className="mx-auto h-4 w-full" />
      <Skeleton className="mx-auto h-4 w-5/6" />
      <Skeleton className="mx-auto mt-6 h-10 w-40 rounded-xl" />
    </div>
  );
}
