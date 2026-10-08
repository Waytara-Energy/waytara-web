"use client";

import { Moon, Sun, SunMoon } from "lucide-react";
import { useThemeMode, type ThemeMode } from "@/components/auto-theme";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ThemeMode; label: string; hint: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", hint: "Always light", icon: Sun },
  { value: "dark", label: "Dark", hint: "Always dark", icon: Moon },
  { value: "auto", label: "Auto", hint: "Light by day (6 am to 6 pm), dark at night", icon: SunMoon },
];

/** Application Settings: light, dark, or Auto (follows the time of day on this device). It applies the moment it is chosen and is
 *  remembered in this browser. */
export function AppearanceSetting() {
  const { mode, setMode } = useThemeMode();
  const mounted = useHasMounted();
  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Appearance</h2>
        <p className="mt-1 text-xs text-muted-foreground">Choose the colour theme. The change applies straight away.</p>
      </div>
      <div role="radiogroup" aria-label="Appearance" className="grid grid-cols-3 gap-2">
        {OPTIONS.map(({ value, label, hint, icon: Icon }) => {
          const selected = mounted && mode === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setMode(value)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                selected ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className={cn("size-5", selected && "text-primary")} />
              <span className="text-sm font-medium">{label}</span>
              <span className="text-[11px] leading-tight opacity-80">{hint}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
