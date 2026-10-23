"use client";

import * as React from "react";
import { BarChart3, Gauge, Moon, Palette, Sparkles, Sun, SunMoon, Type, Wind } from "lucide-react";
import { withPromiseToast } from "@waytara/ui/notify";
import { applyAppearance } from "@/components/appearance-applier";
import { useThemeMode, type ThemeMode } from "@/components/auto-theme";
import { Switch } from "@/components/ui/switch";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { TEXT_SIZES, type AppearancePrefs, type TextSize } from "@/lib/appearance-prefs";
import { CHART_STYLES, type ChartStyle } from "@/lib/chart-style";
import { cn } from "@/lib/utils";
import { saveAppearance } from "@/app/dashboard/settings/account-actions";
import { useChartStyle, useSetChartStyle } from "../chart-style";
import { SettingsCard, ToggleRow } from "./settings-card";

// ---- little pictures of the app in each theme and of each chart style (drawn with fixed colours, so they look right whatever theme is on) ------

function MiniApp({ dark }: { dark: boolean }) {
  const bg = dark ? "#0b0f0e" : "#f8fafc";
  const card = dark ? "#141a18" : "#ffffff";
  const line = dark ? "#26302d" : "#e2e8f0";
  const muted = dark ? "#3a4642" : "#cbd5e1";
  return (
    <svg viewBox="0 0 160 100" className="h-full w-full" aria-hidden>
      <rect width="160" height="100" fill={bg} />
      <rect x="0" y="0" width="30" height="100" fill={card} stroke={line} />
      {[16, 30, 44, 58].map((y) => (
        <rect key={y} x="7" y={y} width="16" height="5" rx="2.5" fill={y === 16 ? "#10b981" : muted} />
      ))}
      <rect x="38" y="8" width="60" height="6" rx="3" fill={muted} />
      <rect x="38" y="22" width="56" height="34" rx="5" fill={card} stroke={line} />
      <rect x="100" y="22" width="56" height="34" rx="5" fill={card} stroke={line} />
      <polyline points="44,48 54,40 64,44 74,32 88,38" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="106" y="30" width="22" height="5" rx="2.5" fill={muted} />
      <rect x="106" y="40" width="34" height="8" rx="2" fill="#0ea5e9" opacity="0.8" />
      <rect x="38" y="62" width="118" height="30" rx="5" fill={card} stroke={line} />
      {[44, 56, 68, 80, 92, 104, 116, 128, 140].map((x, i) => (
        <rect key={x} x={x} y={84 - [8, 14, 10, 18, 12, 20, 9, 15, 11][i]} width="6" height={[8, 14, 10, 18, 12, 20, 9, 15, 11][i]} rx="1.5" fill="#f59e0b" opacity="0.85" />
      ))}
    </svg>
  );
}

function ThemePreview({ mode }: { mode: ThemeMode }) {
  if (mode === "auto") {
    return (
      <div className="relative h-full w-full">
        <div className="absolute inset-0">
          <MiniApp dark={false} />
        </div>
        <div className="absolute inset-0" style={{ clipPath: "polygon(55% 0, 100% 0, 100% 100%, 35% 100%)" }}>
          <MiniApp dark />
        </div>
      </div>
    );
  }
  return <MiniApp dark={mode === "dark"} />;
}

function ChartPreview({ style }: { style: ChartStyle }) {
  const line = <polyline points="6,40 22,28 38,34 54,14 70,22 86,10" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />;
  const bars = [14, 24, 18, 32, 22, 36].map((h, i) => <rect key={i} x={8 + i * 14} y={46 - h} width="9" height={h} rx="2" fill="#10b981" opacity={style === "auto" ? 0.35 : 0.9} />);
  return (
    <svg viewBox="0 0 92 50" className="h-full w-full" aria-hidden>
      {style !== "line" && bars}
      {style !== "bar" && line}
    </svg>
  );
}

const THEMES: { mode: ThemeMode; label: string; hint: string; icon: typeof Sun }[] = [
  { mode: "light", label: "Light", hint: "Always light", icon: Sun },
  { mode: "dark", label: "Dark", hint: "Always dark", icon: Moon },
  { mode: "auto", label: "Auto", hint: "Light by day (6 am to 6 pm), dark at night", icon: SunMoon },
];

const CHARTS: Record<ChartStyle, { label: string; hint: string }> = {
  auto: { label: "Automatic", hint: "Each chart in the style that suits it" },
  line: { label: "Line", hint: "Every chart as a line" },
  bar: { label: "Bar", hint: "Every chart as bars" },
};

function Choice({ selected, onSelect, preview, label, hint, icon: Icon }: { selected: boolean; onSelect: () => void; preview: React.ReactNode; label: string; hint: string; icon?: typeof Sun }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn("group flex flex-col overflow-hidden rounded-xl border text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring", selected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40 hover:shadow-sm")}
    >
      <div className="aspect-[8/5] w-full overflow-hidden border-b border-border bg-muted/40">{preview}</div>
      <div className="flex items-start gap-2 p-3">
        {Icon && <Icon className={cn("mt-0.5 size-4 shrink-0", selected ? "text-primary" : "text-muted-foreground")} />}
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs leading-snug text-muted-foreground">{hint}</p>
        </div>
      </div>
    </button>
  );
}

/** Settings > Appearance: the theme and the chart style, each shown as a little picture of what it does, the size of the text, and reduced motion.
 *  Every choice applies the moment it is made. */
export function AppearanceSection({ initial }: { initial: AppearancePrefs }) {
  const { mode, setMode } = useThemeMode();
  const mounted = useHasMounted();
  const chartStyle = useChartStyle();
  const setChartStyle = useSetChartStyle();
  const [prefs, setPrefs] = React.useState<AppearancePrefs>(initial);

  async function change(next: AppearancePrefs) {
    const before = prefs;
    setPrefs(next);
    applyAppearance(next);
    const ok = await withPromiseToast(saveAppearance, { loading: "Saving…", success: "Saved." })(next);
    if (!ok) {
      setPrefs(before);
      applyAppearance(before);
    }
  }

  return (
    <div className="grid items-start gap-5 xl:grid-cols-2">
      <SettingsCard title="Theme" description="How the whole app looks. It changes the moment you choose." icon={Palette} tone="violet">
        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-3">
          {THEMES.map((t) => (
            <Choice key={t.mode} selected={mounted && mode === t.mode} onSelect={() => setMode(t.mode)} preview={<ThemePreview mode={t.mode} />} label={t.label} hint={t.hint} icon={t.icon} />
          ))}
        </div>
      </SettingsCard>

      <SettingsCard title="Charts" description="How every chart is drawn: Overview, Monitoring, Performance." icon={BarChart3} tone="sky">
        <div role="radiogroup" aria-label="Chart style" className="grid grid-cols-3 gap-3">
          {CHART_STYLES.map((s) => (
            <Choice key={s} selected={chartStyle === s} onSelect={() => setChartStyle(s)} preview={<div className="grid h-full w-full place-items-center p-4"><ChartPreview style={s} /></div>} label={CHARTS[s].label} hint={CHARTS[s].hint} icon={s === "auto" ? Sparkles : Gauge} />
          ))}
        </div>
      </SettingsCard>

      <SettingsCard title="Text size" description="Make everything bigger or smaller. It follows you to every device." icon={Type} tone="amber">
        <div role="radiogroup" aria-label="Text size" className="grid grid-cols-4 gap-2">
          {TEXT_SIZES.map((s) => {
            const on = prefs.textSize === s.id;
            return (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => void change({ ...prefs, textSize: s.id as TextSize })}
                className={cn("flex flex-col items-center gap-1 rounded-xl border px-2 py-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", on ? "border-primary bg-primary/10" : "border-border hover:bg-accent")}
              >
                <span className="font-semibold text-foreground" style={{ fontSize: `${s.percent / 100 * 1.25}rem`, lineHeight: 1.2 }}>
                  Aa
                </span>
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </button>
            );
          })}
        </div>
        <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">The text of the whole dashboard follows this setting: the cards, the tables, the menus.</p>
      </SettingsCard>

      <SettingsCard title="Motion" description="Fewer animations, for a calmer screen or an older device." icon={Wind} tone="teal">
        <ToggleRow title="Reduce motion" description="Charts and menus appear without sliding or fading.">
          <Switch checked={prefs.reduceMotion} onCheckedChange={(v) => void change({ ...prefs, reduceMotion: v })} aria-label="Reduce motion" />
        </ToggleRow>
      </SettingsCard>
    </div>
  );
}
