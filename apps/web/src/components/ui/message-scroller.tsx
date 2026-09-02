"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { ScrollArea } from "./scroll-area"

// Hand-authored analog of a shadcn "Message Scroller" (no such component
// exists in the standard registry) — a ScrollArea that keeps the newest
// message in view, the way any chat UI is expected to behave. Re-runs
// whenever `watch` changes (pass the message list, or its length) rather
// than on every render.
interface MessageScrollerProps extends React.ComponentProps<typeof ScrollArea> {
  watch?: unknown
}

function MessageScroller({ className, children, watch, ...props }: MessageScrollerProps) {
  const bottomRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [watch])

  return (
    <ScrollArea data-slot="message-scroller" className={cn("h-full", className)} {...props}>
      <div className="flex flex-col gap-3 p-4">
        {children}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  )
}

export { MessageScroller }
