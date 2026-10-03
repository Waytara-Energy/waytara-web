"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@waytara/ui/cn";

// Same mounted-guard pattern as apps/web's shared/theme-toggle.tsx —
// `theme` is undefined until after hydration (defaultTheme="system" in
// layout.tsx), so a real icon can't be picked on the server render.
// useSyncExternalStore instead of useState+useEffect(() => setMounted
// (true)) — the getSnapshot/getServerSnapshot split (true vs false) gives
// the same "false" on the server/first paint, "true" after, with no
// extra render from a synchronous setState inside an effect.
function subscribe() {
  return () => {};
}
function getSnapshot() {
  return true;
}
function getServerSnapshot() {
  return false;
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!mounted) {
    return (
      <button type="button" className={cn("flex items-center justify-center", className)} aria-label="Theme toggle loading">
        <span className="block h-[18px] w-[18px]" />
      </button>
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn("flex items-center justify-center", className)}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      aria-label="Toggle theme"
    >
      {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
      <span className="sr-only">Toggle theme</span>
    </button>
  );
}
