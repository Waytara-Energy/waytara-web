import { ConversationSkeleton } from "@/components/dashboard/support-skeletons";

/** A conversation while it loads: the header, the messages, the box to write in and the side cards. */
export default function Loading() {
  return <ConversationSkeleton />;
}
