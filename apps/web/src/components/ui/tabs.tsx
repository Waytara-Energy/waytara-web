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
      // shadcn/ui's "line" tabs — no pill/card chrome around the group at
      // all, just a shared baseline rule that each trigger's own colored
      // underline sits on when active (see the `line` trigger variant
      // below). `flex-wrap` so a narrow viewport wraps to a second line
      // instead of needing horizontal scroll.
      line: "inline-flex h-auto w-full flex-wrap items-center gap-6 border-b border-theme-border bg-transparent p-0",
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
        // shadcn/ui's "line" tab: icon + label on one row, flat text at
        // rest, a colored bottom border promoted in on the active trigger
        // — no background, no pill, no card. The default active color
        // here is just a fallback; each call site overrides it with that
        // tab's own accent (see MONITORING_TABS in monitoring-content.tsx)
        // so the selected tab's underline/label match its own node color
        // instead of one flat green for every tab. `group` lets the
        // trigger's own icon (TabButtonContent) react to this same
        // data-state, e.g. hiding itself while active.
        line: "group inline-flex items-center gap-2 rounded-none border-b-2 border-transparent px-1 pb-3 pt-1 text-theme-muted transition-colors hover:text-theme-primary data-[state=active]:border-primary data-[state=active]:text-theme-primary",
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
