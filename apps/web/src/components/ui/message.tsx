import * as React from "react"

import { cn } from "@/lib/utils"

// Hand-authored — no "Message" component exists in the standard shadcn/ui
// registry under this name. Built for the Support module's ticket chat
// (Phase 6/7 of the dashboard redesign), matching shadcn's own conventions
// (data-slot, plain function components) so it reads like a real registry
// component. Lives in apps/web only; apps/admin gets its own copy for its
// employee-side thread view, matching this repo's "no cross-app imports,
// only packages/* is shared" rule — this is small enough not to warrant a
// new shared package export.

interface MessageProps extends React.ComponentProps<"div"> {
  /** Right-aligns the row — the viewer's own messages. */
  isOwn?: boolean
}

function Message({ className, isOwn = false, ...props }: MessageProps) {
  return (
    <div
      data-slot="message"
      data-own={isOwn}
      className={cn("flex w-full flex-col", isOwn ? "items-end" : "items-start", className)}
      {...props}
    />
  )
}

function MessageHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-header"
      className={cn("mb-1 flex items-center gap-2 px-1 text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

export { Message, MessageHeader }
