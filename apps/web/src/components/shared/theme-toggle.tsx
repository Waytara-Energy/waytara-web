"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  iconClassName?: string;
}

export function ThemeToggle({ className, iconClassName }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        className={cn(
          "p-2 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center focus:outline-none",
          className
        )}
        aria-label="Theme toggle loading"
      >
        <span className="h-[18px] w-[18px] block" />
      </button>
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "p-2 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center focus:outline-none cursor-pointer",
        className
      )}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      aria-label="Toggle theme"
    >
      {isDark ? (
        <Sun className={cn("h-[18px] w-[18px] transition-transform duration-200 rotate-0 scale-100", iconClassName || "text-amber-400")} />
      ) : (
        <Moon className={cn("h-[18px] w-[18px] transition-transform duration-200 rotate-0 scale-100", iconClassName || "text-current")} />
      )}
      <span className="sr-only">Toggle theme</span>
    </button>
  );
}
