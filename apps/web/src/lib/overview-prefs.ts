// What a customer chooses about their Overview: the widgets on it and where they sit (see overview-layout.ts) and what is behind the page.
// Kept in profiles.ui_preferences. Everything read back is checked, so a damaged or hand-edited value falls back to the defaults.
// `cards` is the older choice (four cards beside the energy flow, from before widgets); it only decides the first layout of somebody who has
// not arranged their widgets yet.

import { parseLayout, type WidgetItem } from "./overview-layout";

export const OVERVIEW_CARDS = [
  { id: "solar", label: "Solar generated", hint: "Today's solar energy" },
  { id: "grid", label: "Grid usage", hint: "Net import or export today" },
  { id: "load", label: "Load consumption", hint: "What your site used today" },
  { id: "battery", label: "Battery usage", hint: "Energy stored or used today" },
  { id: "selfpowered", label: "Self-powered", hint: "Share of your use not bought from the grid" },
  { id: "exported", label: "Sent to the grid", hint: "Energy exported today" },
  { id: "imported", label: "Bought from the grid", hint: "Energy imported today" },
] as const;

export type OverviewCardId = (typeof OVERVIEW_CARDS)[number]["id"];
export const OVERVIEW_CARD_COUNT = 4;
export const DEFAULT_OVERVIEW_CARDS: OverviewCardId[] = ["solar", "grid", "load", "battery"];

const CARD_IDS: readonly string[] = OVERVIEW_CARDS.map((c) => c.id);
export const isOverviewCard = (v: unknown): v is OverviewCardId => typeof v === "string" && CARD_IDS.includes(v);

/** Gradients to put behind the Overview. The cards turn to frosted glass over any of them, so the numbers stay readable. */
export const BACKGROUND_PRESETS = [
  { id: "aurora", label: "Aurora", css: "linear-gradient(135deg, #064e3b 0%, #0f766e 45%, #0369a1 100%)" },
  { id: "dusk", label: "Dusk", css: "linear-gradient(135deg, #312e81 0%, #6d28d9 50%, #be185d 100%)" },
  { id: "sunrise", label: "Sunrise", css: "linear-gradient(135deg, #7c2d12 0%, #c2410c 45%, #f59e0b 100%)" },
  { id: "ocean", label: "Ocean", css: "linear-gradient(160deg, #0c4a6e 0%, #155e75 50%, #134e4a 100%)" },
  { id: "forest", label: "Forest", css: "linear-gradient(150deg, #14532d 0%, #166534 50%, #365314 100%)" },
  { id: "graphite", label: "Graphite", css: "linear-gradient(145deg, #111827 0%, #1f2937 55%, #374151 100%)" },
] as const;

export type BackgroundPresetId = (typeof BACKGROUND_PRESETS)[number]["id"];
const PRESET_IDS: readonly string[] = BACKGROUND_PRESETS.map((p) => p.id);

export type OverviewBackground = { kind: "none" } | { kind: "preset"; id: BackgroundPresetId } | { kind: "image"; path: string };

export interface OverviewPrefs {
  cards: OverviewCardId[];
  /** the widgets the person arranged, or null before they ever did (the page then uses defaultLayout(cards, ...)) */
  layout: WidgetItem[] | null;
  background: OverviewBackground;
  /** how much a picture is darkened so the cards stay readable, 0 to 80 (per cent) */
  dim: number;
}

export const DEFAULT_OVERVIEW_PREFS: OverviewPrefs = { cards: DEFAULT_OVERVIEW_CARDS, layout: null, background: { kind: "none" }, dim: 35 };

/** A picture a person uploaded: `<their id>/overview-<digits>.<ext>` in the avatars bucket. Anything else is not accepted. */
export const BACKGROUND_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/overview-\d{10,16}\.(jpg|jpeg|png|webp)$/;
export const isBackgroundPathOf = (path: string, userId: string): boolean => BACKGROUND_PATH.test(path) && path.startsWith(`${userId}/`);

const clampDim = (n: unknown): number => (typeof n === "number" && Number.isFinite(n) ? Math.min(80, Math.max(0, Math.round(n))) : DEFAULT_OVERVIEW_PREFS.dim);

export function parseOverviewPrefs(raw: unknown): OverviewPrefs {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const picked = Array.isArray(o.overview_cards) ? o.overview_cards.filter(isOverviewCard) : [];
  const unique = [...new Set(picked)];
  const cards = unique.length === OVERVIEW_CARD_COUNT ? unique : DEFAULT_OVERVIEW_CARDS;

  const b = o.overview_background && typeof o.overview_background === "object" ? (o.overview_background as Record<string, unknown>) : {};
  let background: OverviewBackground = { kind: "none" };
  if (b.kind === "preset" && typeof b.id === "string" && PRESET_IDS.includes(b.id)) background = { kind: "preset", id: b.id as BackgroundPresetId };
  else if (b.kind === "image" && typeof b.path === "string" && BACKGROUND_PATH.test(b.path)) background = { kind: "image", path: b.path };

  return { cards, layout: parseLayout(o), background, dim: clampDim(o.overview_dim) };
}

/** The background part stored in profiles.ui_preferences (the other keys of that column, the layout included, are kept by the caller). */
export function overviewToJson(p: Pick<OverviewPrefs, "background" | "dim">): { overview_background: OverviewBackground; overview_dim: number } {
  return { overview_background: p.background, overview_dim: clampDim(p.dim) };
}

/** The CSS that paints a background, or null for none. `imageUrl` is where the person's picture is served from. */
export function backgroundCss(bg: OverviewBackground, imageUrl: string | null, dim: number): string | null {
  if (bg.kind === "preset") return BACKGROUND_PRESETS.find((p) => p.id === bg.id)?.css ?? null;
  if (bg.kind === "image" && imageUrl) {
    const shade = `rgba(0,0,0,${(clampDim(dim) / 100).toFixed(2)})`;
    return `linear-gradient(${shade}, ${shade}), url("${imageUrl.replace(/"/g, "%22")}") center / cover no-repeat`;
  }
  return null;
}

