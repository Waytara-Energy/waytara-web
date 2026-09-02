import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Hand-authored analog of a shadcn "Bubble" component (no such component
// exists in the standard registry) — the colored speech-bubble itself,
// meant to sit inside <Message>. See message.tsx for the broader note on
// why this is hand-built rather than CLI-added.
const messageBubbleVariants = cva("max-w-[75%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed", {
  variants: {
    variant: {
      own: "rounded-br-sm bg-primary text-primary-foreground",
      other: "rounded-bl-sm border border-border bg-muted text-foreground",
      system:
        "mx-auto max-w-full rounded-full bg-muted/60 px-3 py-1 text-center text-xs text-muted-foreground",
    },
  },
  defaultVariants: { variant: "other" },
})

interface MessageBubbleProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof messageBubbleVariants> {}

function MessageBubble({ className, variant, ...props }: MessageBubbleProps) {
  return (
    <div
      data-slot="message-bubble"
      className={cn(messageBubbleVariants({ variant, className }))}
      {...props}
    />
  )
}

export { MessageBubble, messageBubbleVariants }
