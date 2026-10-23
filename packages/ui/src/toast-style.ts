/** The look of every toast in both apps: a white rounded card with a tinted icon tile, a bold title, muted text and tidy buttons beneath
 *  (the same language as the cookie card). Sonner draws the toast as a flex row, so it is turned into a two-column grid here: the icon
 *  tile on the left, the words and any button under them on the right. A toast with no icon uses the full width. Plain classes only,
 *  so both apps' Tailwind picks them up through their @source of packages/ui. */

export const TOAST_CLASSNAMES = {
  toast:
    "group !grid !grid-cols-[auto_1fr] !items-start !gap-x-3 !gap-y-2.5 !rounded-2xl !border !border-border !bg-popover !p-4 !text-popover-foreground !shadow-lg " +
    "[&:not(:has([data-icon]))]:!grid-cols-1 [&:not(:has([data-icon]))>*]:!col-start-1 " +
    "[&_[data-icon]]:!m-0 [&_[data-icon]]:!flex [&_[data-icon]]:!size-9 [&_[data-icon]]:!items-center [&_[data-icon]]:!justify-center [&_[data-icon]]:!rounded-xl " +
    "[&_[data-icon]>svg]:!size-4",
  content: "!col-start-2 !min-w-0 !gap-0.5",
  title: "!text-sm !font-semibold !leading-5 !text-foreground",
  description: "!text-xs !leading-snug !text-muted-foreground",
  actionButton:
    "!col-start-2 !m-0 !h-8 !justify-self-start !rounded-lg !bg-foreground !px-3 !text-xs !font-medium !text-background hover:!opacity-90",
  cancelButton:
    "!col-start-2 !m-0 !h-8 !justify-self-start !rounded-lg !bg-muted !px-3 !text-xs !font-medium !text-foreground hover:!bg-muted/70",
  success: "[&_[data-icon]]:!bg-emerald-500/12 [&_[data-icon]]:!text-emerald-600",
  error: "[&_[data-icon]]:!bg-red-500/12 [&_[data-icon]]:!text-red-600",
  warning: "[&_[data-icon]]:!bg-amber-500/12 [&_[data-icon]]:!text-amber-600",
  info: "[&_[data-icon]]:!bg-blue-500/12 [&_[data-icon]]:!text-blue-600",
  loading: "[&_[data-icon]]:!bg-muted [&_[data-icon]]:!text-foreground",
  default: "[&_[data-icon]]:!bg-muted [&_[data-icon]]:!text-foreground",
} as const;
