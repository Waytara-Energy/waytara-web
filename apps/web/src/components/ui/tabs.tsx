"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const tabsListVariants = cva("", {
  variants: {
    variant: {
      default: "inline-flex h-12 items-center justify-center rounded-xl border border-theme-border bg-theme-surface p-1 text-theme-secondary",
      // Underlined strip instead of a pill group — no background/border
      // around the group itself, just a baseline rule the active trigger's
      // own underline sits on. `items-stretch` (not `items-center`) so
      // every trigger is stretched to the row's own height regardless of
      // how much content it shows — the active trigger's taller stat block
      // pushes the row taller, but every trigger's own border-b-2 still
      // lands on the same shared baseline instead of hugging its own
      // (shorter) content.
      line: "inline-flex h-auto w-full flex-wrap items-stretch justify-start gap-6 border-b border-theme-border bg-transparent p-0",
      // A compact segmented control — the same shape as `default` above
      // (one small bounded tray, pill buttons inside it) rather than
      // anything sized or shaped like the content cards underneath it.
      // Earlier attempts kept the tab's own live number *inside* the tab
      // button, which forced the button to grow big enough to hold a
      // headline stat — right when it starts looking like a card. The fix
      // isn't more styling on the button, it's moving that number out of
      // the button entirely (see MonitoringContent's `TabHeadline`, shown
      // once at the top of the selected tab's own panel instead). That
      // leaves this control free to just be small buttons, which can't be
      // mistaken for a card at any size. `overflow-x-auto` so a narrow
      // viewport scrolls the row instead of wrapping it — the same
      // swipeable-segmented-control pattern most phone dashboards use, so
      // it holds up at any device width without special-casing.
      card: "inline-flex h-auto w-full items-center gap-1 overflow-x-auto rounded-xl border border-theme-border bg-theme-surface p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
    },
  },
  defaultVariants: { variant: "default" },
});

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>
>(({ className, variant, ...props }, ref) => (
  <TabsPrimitive.List ref={ref} className={cn(tabsListVariants({ variant }), className)} {...props} />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const tabsTriggerVariants = cva(
  "whitespace-nowrap text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "inline-flex items-center justify-center rounded-lg px-4 py-2 data-[state=active]:bg-primary-gradient data-[state=active]:text-white data-[state=active]:shadow-sm",
        // Column layout (not `inline-flex items-center justify-center`) so
        // an icon+label row can sit on top with an optional stat block
        // stacked underneath it, only shown on the active trigger — see
        // MonitoringTabContent, the one caller of this variant today.
        // `justify-end` (not `justify-start`) so every trigger's content
        // hugs the bottom of the row — an inactive trigger (just the
        // icon+label row) sits flush on the shared underline instead of
        // floating up near the active trigger's own header row, with any
        // leftover height going above the content instead of below it.
        // `group` lives on the variant itself rather than each call site
        // repeating `className="group"`.
        line: "group inline-flex flex-col items-start justify-end gap-1.5 rounded-none border-b-2 border-transparent px-0.5 pb-3 text-left text-theme-muted transition-colors hover:text-theme-primary data-[state=active]:border-primary data-[state=active]:text-theme-primary",
        // A plain pill button — icon + label, one line, same size whether
        // active or not (see the `default` variant above, which this
        // mirrors). No stat block lives here any more; MonitoringContent's
        // `TabHeadline` shows the selected tab's number in the panel
        // content instead, so this button never needs to grow.
        card: "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-theme-secondary transition-colors hover:bg-theme-surface-hover data-[state=active]:bg-primary-gradient data-[state=active]:text-white data-[state=active]:shadow-sm",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & VariantProps<typeof tabsTriggerVariants>
>(({ className, variant, ...props }, ref) => (
  <TabsPrimitive.Trigger ref={ref} className={cn(tabsTriggerVariants({ variant }), className)} {...props} />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-3 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
