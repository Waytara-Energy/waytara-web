// How the dashboard looks beyond the theme: the size of the text and whether things move. Kept in profiles.ui_preferences.appearance and
// applied by AppearanceApplier (the dashboard layout), so it follows the person to every device.

export const TEXT_SIZES = [
  { id: "sm", label: "Small", percent: 93 },
  { id: "md", label: "Default", percent: 100 },
  { id: "lg", label: "Large", percent: 110 },
  { id: "xl", label: "Extra large", percent: 120 },
] as const;

export type TextSize = (typeof TEXT_SIZES)[number]["id"];

export interface AppearancePrefs {
  textSize: TextSize;
  reduceMotion: boolean;
  /** Whether to draw today's sunrise and sunset times on monitoring graphs like Apple Weather. */
  weatherOverlay: boolean;
}

export const DEFAULT_APPEARANCE: AppearancePrefs = { textSize: "md", reduceMotion: false, weatherOverlay: false };

export function parseAppearance(raw: unknown): AppearancePrefs {
  const root = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const a = root.appearance && typeof root.appearance === "object" ? (root.appearance as Record<string, unknown>) : {};
  const size = TEXT_SIZES.find((s) => s.id === a.text_size)?.id ?? DEFAULT_APPEARANCE.textSize;
  return { textSize: size, reduceMotion: a.reduce_motion === true, weatherOverlay: a.weather_overlay === true };
}

export const appearanceToJson = (p: AppearancePrefs): { text_size: TextSize; reduce_motion: boolean; weather_overlay: boolean } => ({
  text_size: p.textSize,
  reduce_motion: p.reduceMotion,
  weather_overlay: p.weatherOverlay,
});

export const textPercent = (size: TextSize): number => TEXT_SIZES.find((s) => s.id === size)?.percent ?? 100;
