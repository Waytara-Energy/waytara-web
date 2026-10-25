"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

interface SwipeTabsContextValue {
  activeValue: string | undefined;
  direction: "next" | "prev" | "none";
  changeTab: (value: string, explicitDir?: "next" | "prev") => void;
  registerTab: (value: string) => () => void;
  getTabOrder: () => string[];
}

const SwipeTabsContext = React.createContext<SwipeTabsContextValue | null>(null);

export function useSwipeTabs() {
  const context = React.useContext(SwipeTabsContext);
  return (
    context ?? {
      activeValue: undefined,
      direction: "none" as const,
      changeTab: () => {},
      registerTab: () => () => {},
      getTabOrder: () => [],
    }
  );
}

export interface TabsProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root> {
  enableSwipe?: boolean;
}

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  TabsProps
>(
  (
    {
      value: controlledValue,
      defaultValue,
      onValueChange,
      enableSwipe = true,
      className,
      children,
      ...props
    },
    forwardedRef
  ) => {
    const rootRef = React.useRef<HTMLDivElement | null>(null);
    const [uncontrolledValue, setUncontrolledValue] = React.useState<string>(
      defaultValue ?? ""
    );
    const [direction, setDirection] = React.useState<"next" | "prev" | "none">("none");
    const registeredTabsRef = React.useRef<string[]>([]);
    const [registeredTabs, setRegisteredTabs] = React.useState<string[]>([]);

    const isControlled = controlledValue !== undefined;
    const activeValue = isControlled ? controlledValue : uncontrolledValue;
    const prevActiveValueRef = React.useRef<string | undefined>(activeValue);

    const registerTab = React.useCallback((val: string) => {
      if (!val) return () => {};
      registeredTabsRef.current = registeredTabsRef.current.includes(val)
        ? registeredTabsRef.current
        : [...registeredTabsRef.current, val];
      setRegisteredTabs((prev) => (prev.includes(val) ? prev : [...prev, val]));
      return () => {
        registeredTabsRef.current = registeredTabsRef.current.filter((t) => t !== val);
        setRegisteredTabs((prev) => prev.filter((t) => t !== val));
      };
    }, []);

    const getTabOrder = React.useCallback((): string[] => {
      if (rootRef.current) {
        const triggers = Array.from(
          rootRef.current.querySelectorAll<HTMLElement>('[role="tab"][data-value]')
        );
        if (triggers.length > 0) {
          const domValues = triggers
            .map((el) => el.getAttribute("data-value") || el.getAttribute("value"))
            .filter((v): v is string => Boolean(v));
          if (domValues.length > 0) return domValues;
        }
      }
      return registeredTabsRef.current;
    }, []);

    const changeTab = React.useCallback(
      (nextVal: string, explicitDir?: "next" | "prev") => {
        if (!nextVal || nextVal === activeValue) return;

        if (explicitDir) {
          setDirection(explicitDir);
        } else {
          const order = getTabOrder();
          const oldIdx = activeValue ? order.indexOf(activeValue) : -1;
          const newIdx = order.indexOf(nextVal);
          if (oldIdx !== -1 && newIdx !== -1) {
            setDirection(newIdx > oldIdx ? "next" : "prev");
          }
        }

        if (!isControlled) {
          setUncontrolledValue(nextVal);
        }
        onValueChange?.(nextVal);
      },
      [activeValue, getTabOrder, isControlled, onValueChange]
    );

    // Track when activeValue changes externally (e.g. from hash change or parent state)
    React.useEffect(() => {
      if (prevActiveValueRef.current !== activeValue) {
        if (prevActiveValueRef.current && activeValue) {
          const order = getTabOrder();
          const oldIdx = order.indexOf(prevActiveValueRef.current);
          const newIdx = order.indexOf(activeValue);
          if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
            setDirection(newIdx > oldIdx ? "next" : "prev");
          }
        }
        prevActiveValueRef.current = activeValue;
      }
    }, [activeValue, getTabOrder]);

    // Touch gesture detection for mobile swiping like Instagram
    const touchState = React.useRef<{
      startX: number;
      startY: number;
      currentX: number;
      currentY: number;
      startTime: number;
      isSwipingHorizontal: boolean | null;
      ignore: boolean;
    }>({
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      startTime: 0,
      isSwipingHorizontal: null,
      ignore: false,
    });

    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
      if (!enableSwipe || e.touches.length > 1) {
        touchState.current.ignore = true;
        return;
      }

      const target = e.target as HTMLElement | null;
      if (
        !target ||
        target.closest('[role="tablist"]') ||
        target.closest(
          'input, textarea, select, [role="slider"], [data-no-swipe="true"], .no-swipe, .maplibregl-canvas, .maplibregl-map, .recharts-surface'
        )
      ) {
        touchState.current.ignore = true;
        return;
      }

      const touch = e.touches[0];
      touchState.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        currentX: touch.clientX,
        currentY: touch.clientY,
        startTime: Date.now(),
        isSwipingHorizontal: null,
        ignore: false,
      };
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
      if (!enableSwipe || touchState.current.ignore) return;

      const touch = e.touches[0];
      touchState.current.currentX = touch.clientX;
      touchState.current.currentY = touch.clientY;

      const deltaX = touch.clientX - touchState.current.startX;
      const deltaY = touch.clientY - touchState.current.startY;

      if (touchState.current.isSwipingHorizontal === null) {
        const dist = Math.hypot(deltaX, deltaY);
        if (dist > 8) {
          if (Math.abs(deltaY) > Math.abs(deltaX)) {
            // Dominantly vertical: user is scrolling page down/up
            touchState.current.isSwipingHorizontal = false;
          } else {
            // Dominantly horizontal: user is swiping tab
            touchState.current.isSwipingHorizontal = true;
          }
        }
      }
    };

    const handleTouchEnd = () => {
      if (
        !enableSwipe ||
        touchState.current.ignore ||
        touchState.current.isSwipingHorizontal !== true
      ) {
        return;
      }

      const deltaX = touchState.current.currentX - touchState.current.startX;
      const deltaY = touchState.current.currentY - touchState.current.startY;
      const elapsed = Math.max(1, Date.now() - touchState.current.startTime);
      const velocityX = Math.abs(deltaX) / elapsed;

      const isQuickFlick = Math.abs(deltaX) >= 28 && velocityX >= 0.22;
      const isLongSwipe = Math.abs(deltaX) >= 42;
      const isDominantHorizontal = Math.abs(deltaX) > Math.abs(deltaY) * 1.25;

      if ((isQuickFlick || isLongSwipe) && isDominantHorizontal) {
        const order = getTabOrder();
        if (order.length > 1 && activeValue) {
          const currentIdx = order.indexOf(activeValue);
          if (deltaX < 0) {
            // Swipe left -> next tab
            if (currentIdx !== -1 && currentIdx < order.length - 1) {
              changeTab(order[currentIdx + 1], "next");
            }
          } else if (deltaX > 0) {
            // Swipe right -> previous tab
            if (currentIdx > 0) {
              changeTab(order[currentIdx - 1], "prev");
            }
          }
        }
      }
    };

    const handleTouchCancel = () => {
      touchState.current.ignore = true;
    };

    const setRefs = React.useCallback(
      (node: HTMLDivElement | null) => {
        rootRef.current = node;
        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        } else if (forwardedRef) {
          (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }
      },
      [forwardedRef]
    );

    return (
      <SwipeTabsContext.Provider
        value={{
          activeValue,
          direction,
          changeTab,
          registerTab,
          getTabOrder,
        }}
      >
        <TabsPrimitive.Root
          ref={setRefs}
          value={activeValue}
          onValueChange={(val) => changeTab(val)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
          className={cn("overflow-x-clip", className)}
          {...props}
        >
          {children}
        </TabsPrimitive.Root>
      </SwipeTabsContext.Provider>
    );
  }
);
Tabs.displayName = "Tabs";

const tabsListVariants = cva("", {
  variants: {
    variant: {
      default:
        "relative inline-flex h-12 max-w-full items-center justify-start sm:justify-center overflow-x-auto no-scrollbar scroll-smooth overscroll-x-contain rounded-xl border border-theme-border bg-theme-surface p-1 text-theme-secondary",
      // shadcn/ui's "line" tabs — sleek horizontal scroll on mobile with no-scrollbar,
      // never wrapping into an awkward second line. Active triggers smoothly center themselves.
      line:
        "relative inline-flex h-auto w-full flex-nowrap items-center gap-6 overflow-x-auto no-scrollbar scroll-smooth overscroll-x-contain touch-pan-x border-b border-theme-border bg-transparent p-0",
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
          "inline-flex items-center justify-center rounded-lg px-4 py-2 data-[state=active]:bg-primary-gradient data-[state=active]:text-white data-[state=active]:shadow-sm shrink-0",
        // shadcn/ui's "line" tab: icon + label on one row, flat text at
        // rest, colored bottom border on active trigger.
        line:
          "group inline-flex shrink-0 items-center gap-2 rounded-none border-b-2 border-transparent px-1 pb-3 pt-1 text-theme-muted transition-colors hover:text-theme-primary data-[state=active]:border-primary data-[state=active]:text-theme-primary",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & VariantProps<typeof tabsTriggerVariants>
>(({ className, variant, value, onClick, ...props }, forwardedRef) => {
  const { activeValue, registerTab, changeTab } = useSwipeTabs();
  const innerRef = React.useRef<HTMLButtonElement | null>(null);
  const isInitialMount = React.useRef(true);

  React.useEffect(() => {
    return registerTab(value);
  }, [registerTab, value]);

  // Smoothly center the active tab in the horizontally scrollable tab list on mobile
  React.useEffect(() => {
    if (activeValue === value && innerRef.current) {
      const el = innerRef.current;
      const container = el.closest<HTMLElement>('[role="tablist"]');
      if (container && container.scrollWidth > container.clientWidth) {
        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const targetScrollLeft =
          container.scrollLeft +
          (elRect.left - containerRect.left) -
          (containerRect.width - elRect.width) / 2;
        container.scrollTo({
          left: Math.max(0, targetScrollLeft),
          behavior: isInitialMount.current ? "instant" : "smooth",
        });
      }
      isInitialMount.current = false;
    }
  }, [activeValue, value]);

  const setRefs = React.useCallback(
    (node: HTMLButtonElement | null) => {
      innerRef.current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        (forwardedRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
      }
    },
    [forwardedRef]
  );

  return (
    <TabsPrimitive.Trigger
      ref={setRefs}
      value={value}
      data-value={value}
      onClick={(e) => {
        changeTab(value);
        onClick?.(e);
      }}
      className={cn(tabsTriggerVariants({ variant }), className)}
      {...props}
    />
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => {
  const { direction } = useSwipeTabs();
  const animClass =
    direction === "next"
      ? "animate-tab-slide-left"
      : direction === "prev"
      ? "animate-tab-slide-right"
      : "";

  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn(
        "mt-3 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
        animClass,
        className
      )}
      {...props}
    />
  );
});
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
