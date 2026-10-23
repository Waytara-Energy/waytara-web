import { HelpSkeleton } from "@/components/dashboard/support-skeletons";

/** The right side of Support while no ticket is open (the ticket list on the left is the layout's own and has its own skeleton). */
export default function Loading() {
  return <HelpSkeleton />;
}
