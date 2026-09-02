"use client"

import * as React from "react"
import { Download, FileText, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "./button"

// Hand-authored analog of a shadcn "Attachment" component (no such
// component exists in the standard registry) — a file chip for the
// Support module's chat thread and its "new ticket" intake form: shows a
// filename (+ size, if known), and either a download link (an already-
// sent message's attachment) or a remove button (a pending upload before
// send) — never both.
interface AttachmentProps extends React.ComponentProps<"div"> {
  fileName: string
  fileSize?: number
  href?: string
  onRemove?: () => void
}

function formatBytes(bytes?: number): string | null {
  if (bytes == null) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function Attachment({ className, fileName, fileSize, href, onRemove, ...props }: AttachmentProps) {
  const size = formatBytes(fileSize)

  return (
    <div
      data-slot="attachment"
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm",
        className
      )}
      {...props}
    >
      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{fileName}</p>
        {size && <p className="text-xs text-muted-foreground">{size}</p>}
      </div>
      {href && (
        <Button asChild variant="ghost" size="icon" className="h-7 w-7 shrink-0">
          <a href={href} target="_blank" rel="noreferrer" download aria-label={`Download ${fileName}`}>
            <Download className="h-3.5 w-3.5" />
          </a>
        </Button>
      )}
      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={onRemove}
          aria-label={`Remove ${fileName}`}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}

export { Attachment }
