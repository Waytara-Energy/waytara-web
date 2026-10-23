/** The look of every toast in both apps: a white rounded card with a tinted icon tile, a bold title, muted text and tidy buttons beneath
 *  (the same language as the cookie card). Sonner draws the toast as a flex row; here it wraps: the icon
 *  tile and the words on the first row, the buttons under the words. A toast with no icon uses the full width. Plain classes only,
 *  so both apps' Tailwind picks them up through their @source of packages/ui. */

export const TOAST_CLASSNAMES = {
  toast:
    "group !flex !flex-wrap !items-start !gap-x-3 !gap-y-2.5 !rounded-2xl !border !border-border !bg-popover !p-4 !text-popover-foreground !shadow-lg " +
    "[&_[data-icon]]:!m-0 [&_[data-icon]]:!flex [&_[data-icon]]:!size-9 [&_[data-icon]]:!shrink-0 [&_[data-icon]]:!items-center [&_[data-icon]]:!justify-center [&_[data-icon]]:!rounded-xl " +
    "[&_[data-icon]>svg]:!size-4 [&:not(:has([data-icon]))>button]:!ml-0 [&:not(:has([data-icon]))>[data-content]]:!basis-full",
  // the icon tile (2.25rem) and the gap (0.75rem) take 3rem: the words fill the rest of the first row, the buttons sit on the next one under them
  content: "!min-w-0 !flex-1 !basis-[calc(100%-3rem)] !gap-0.5",
  title: "!text-sm !font-semibold !leading-5 !text-foreground",
  description: "!text-xs !leading-snug !text-muted-foreground",
  actionButton: "!order-1 !m-0 !ml-12 !h-8 !rounded-lg !bg-foreground !px-3 !text-xs !font-medium !text-background hover:!opacity-90",
  cancelButton: "!order-2 !m-0 !h-8 !rounded-lg !bg-muted !px-3 !text-xs !font-medium !text-foreground hover:!bg-muted/70",
  success: "[&_[data-icon]]:!bg-emerald-500/12 [&_[data-icon]]:!text-emerald-600",
  error: "[&_[data-icon]]:!bg-red-500/12 [&_[data-icon]]:!text-red-600",
  warning: "[&_[data-icon]]:!bg-amber-500/12 [&_[data-icon]]:!text-amber-600",
  info: "[&_[data-icon]]:!bg-blue-500/12 [&_[data-icon]]:!text-blue-600",
  loading: "[&_[data-icon]]:!bg-muted [&_[data-icon]]:!text-foreground",
  default: "[&_[data-icon]]:!bg-muted [&_[data-icon]]:!text-foreground",
} as const;
