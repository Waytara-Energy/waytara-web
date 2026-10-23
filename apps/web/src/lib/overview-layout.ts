// The Overview as a board of widgets a customer arranges themselves, like the home screen of a phone: pick widgets, give each one a colour theme,
// drag them where they want them and stretch them bigger or smaller. This file is the pure part: what widgets exist, how a layout is read back
// from storage (checked, so a damaged value never breaks the page), and the rules that keep a layout tidy: nothing overlaps, nothing leaves the
// board, and everything is packed upwards so there are no holes.
//
// The board is GRID_COLS columns wide and as many rows tall as needed. A widget is x, y (its top-left cell) and w, h (cells).

export const GRID_COLS = 12;
/** The rows the default layout fills; the page is sized so these fit the screen without scrolling. */
export const FIT_ROWS = 12;
export const MAX_WIDGETS = 24;

export type WidgetGroup = "Energy today" | "Live" | "EV charger" | "Extras";
export type WidgetNeeds = "inverter" | "charger" | null;

export interface WidgetMeta {
  type: string;
  label: string;
  hint: string;
  group: WidgetGroup;
  /** the first size when it is added (cells), and the smallest and largest it can be stretched to */
  w: number;
  h: number;
  minW: number;
  minH: number;
  maxW: number;
  maxH: number;
  /** the device a site must have for this widget to show anything */
  needs: WidgetNeeds;
}

const stat = <T extends string>(type: T, label: string, hint: string): WidgetMeta & { type: T } => ({ type, label, hint, group: "Energy today", w: 3, h: 4, minW: 2, minH: 3, maxW: 6, maxH: 8, needs: "inverter" });
const ev = <T extends string>(type: T, label: string, hint: string): WidgetMeta & { type: T } => ({ type, label, hint, group: "EV charger", w: 3, h: 2, minW: 2, minH: 2, maxW: 6, maxH: 3, needs: "charger" });

export const WIDGETS = [
  stat("solar", "Solar generated", "Today's solar energy, with the last two hours"),
  stat("grid", "Grid usage", "Net import or export today"),
  stat("load", "Load consumption", "What your site used today"),
  stat("battery", "Battery usage", "Energy stored or used today"),
  stat("selfpowered", "Self-powered", "Share of your use not bought from the grid"),
  stat("exported", "Sent to the grid", "Energy exported today"),
  stat("imported", "Bought from the grid", "Energy imported today"),
  { type: "flow", label: "Energy flow", hint: "Where the power goes right now", group: "Live", w: 6, h: 8, minW: 4, minH: 5, maxW: 12, maxH: 14, needs: "inverter" },
  { type: "battery_level", label: "Battery level", hint: "How full the battery is", group: "Live", w: 3, h: 4, minW: 2, minH: 3, maxW: 6, maxH: 8, needs: "inverter" },
  { type: "power_now", label: "Power now", hint: "Solar, load, grid and battery in kW", group: "Live", w: 4, h: 3, minW: 3, minH: 2, maxW: 12, maxH: 5, needs: "inverter" },
  ev("ev_power", "Charging power", "What the EV charger is delivering"),
  ev("ev_current", "Charging current", "Current and voltage at the charger"),
  ev("ev_temp", "Connector temperature", "How warm the connector is"),
  ev("ev_energy", "Energy delivered today", "Energy and cost of today's charging"),
  { type: "clock", label: "Clock", hint: "The time and date, with a greeting", group: "Extras", w: 3, h: 2, minW: 2, minH: 1, maxW: 6, maxH: 3, needs: null },
] as const satisfies readonly WidgetMeta[];

export type WidgetType = (typeof WIDGETS)[number]["type"];
const META = new Map<string, WidgetMeta>(WIDGETS.map((w) => [w.type, w]));
export const widgetMeta = (type: string): WidgetMeta | undefined => META.get(type);
export const isWidgetType = (v: unknown): v is WidgetType => typeof v === "string" && META.has(v);
export const WIDGET_GROUPS: WidgetGroup[] = ["Energy today", "Live", "EV charger", "Extras"];

/** The colour themes a widget can wear. "default" is the normal card; the others tint the whole widget (see the .ov-theme-* rules in globals.css). */
export const WIDGET_THEMES = [
  { id: "default", label: "Default", swatch: "var(--card)" },
  { id: "glass", label: "Glass", swatch: "linear-gradient(135deg, rgba(255,255,255,0.85), rgba(148,163,184,0.45))" },
  { id: "emerald", label: "Emerald", swatch: "linear-gradient(135deg, #047857, #10b981)" },
  { id: "ocean", label: "Ocean", swatch: "linear-gradient(135deg, #0369a1, #0891b2)" },
  { id: "sunset", label: "Sunset", swatch: "linear-gradient(135deg, #c2410c, #f59e0b)" },
  { id: "violet", label: "Violet", swatch: "linear-gradient(135deg, #5b21b6, #a855f7)" },
  { id: "rose", label: "Rose", swatch: "linear-gradient(135deg, #be123c, #fb7185)" },
  { id: "ink", label: "Ink", swatch: "#0b0b0c" },
  { id: "graphite", label: "Graphite", swatch: "linear-gradient(135deg, #111827, #374151)" },
] as const;
export type WidgetTheme = (typeof WIDGET_THEMES)[number]["id"];
const THEME_IDS: readonly string[] = WIDGET_THEMES.map((t) => t.id);
export const isWidgetTheme = (v: unknown): v is WidgetTheme => typeof v === "string" && THEME_IDS.includes(v);

export interface WidgetItem {
  /** unique on the board: "solar-1" */
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
  theme: WidgetTheme;
}

// ---- geometry --------------------------------------------------------------------------------------------------------------------------

const hit = (a: WidgetItem, b: WidgetItem): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const byYX = (a: WidgetItem, b: WidgetItem): number => a.y - b.y || a.x - b.x;
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** A widget kept inside the board and inside the sizes its kind allows. */
export function fit(item: WidgetItem): WidgetItem {
  const m = widgetMeta(item.type)!;
  const w = clamp(Math.round(item.w), m.minW, m.maxW);
  const h = clamp(Math.round(item.h), m.minH, m.maxH);
  return { ...item, w, h, x: clamp(Math.round(item.x), 0, GRID_COLS - w), y: Math.max(0, Math.round(item.y)) };
}

/**
 * Packs a layout: every widget keeps its place unless another one is in the way (then it moves down past it), and then rises as far as it can,
 * so there are no holes above anything. `first` wins a collision (the widget being dragged or stretched). Order of placement is top to bottom,
 * then left to right, which is what makes the result stable: the same layout in gives the same layout out.
 */
export function settle(items: readonly WidgetItem[], first?: WidgetItem): WidgetItem[] {
  const placed: WidgetItem[] = first ? [first] : [];
  const rest = items.filter((i) => i.id !== first?.id).sort(byYX);
  for (const item of rest) {
    let y = item.y;
    for (let guard = 0; guard < 200; guard++) {
      const blockers = placed.filter((p) => hit(p, { ...item, y }));
      if (blockers.length === 0) break;
      y = Math.max(...blockers.map((p) => p.y + p.h));
    }
    while (y > 0 && !placed.some((p) => hit(p, { ...item, y: y - 1 }))) y--;
    placed.push({ ...item, y });
  }
  const at = new Map(placed.map((p) => [p.id, p]));
  return items.map((i) => at.get(i.id) ?? i);
}

/** `item` moved or resized to `next` (cells); everything else makes room, and the item itself rises as far as it can. */
function place(items: readonly WidgetItem[], id: string, next: Partial<Pick<WidgetItem, "x" | "y" | "w" | "h">>): WidgetItem[] {
  const current = items.find((i) => i.id === id);
  if (!current) return [...items];
  const moved = fit({ ...current, ...next });
  const made = settle(items.map((i) => (i.id === id ? moved : i)), moved);
  const others = made.filter((i) => i.id !== id);
  let y = moved.y;
  while (y > 0 && !others.some((o) => hit(o, { ...moved, y: y - 1 }))) y--;
  const final = { ...moved, y };
  return settle(made.map((i) => (i.id === id ? final : i)), final);
}

export const moveWidget = (items: readonly WidgetItem[], id: string, x: number, y: number): WidgetItem[] => place(items, id, { x, y });
export const resizeWidget = (items: readonly WidgetItem[], id: string, w: number, h: number): WidgetItem[] => place(items, id, { w, h });
export const themeWidget = (items: readonly WidgetItem[], id: string, theme: WidgetTheme): WidgetItem[] => items.map((i) => (i.id === id ? { ...i, theme } : i));
export const removeWidget = (items: readonly WidgetItem[], id: string): WidgetItem[] => settle(items.filter((i) => i.id !== id));

/** The id for a new widget of this kind: the first "<type>-<n>" not in use. */
export function newWidgetId(items: readonly WidgetItem[], type: string): string {
  const used = new Set(items.map((i) => i.id));
  for (let n = 1; ; n++) if (!used.has(`${type}-${n}`)) return `${type}-${n}`;
}

/** Adds a widget in the first free spot (reading left to right, top to bottom); null when the board is full (MAX_WIDGETS) or the kind is unknown. */
export function addWidget(items: readonly WidgetItem[], type: string, theme: WidgetTheme = "default"): WidgetItem[] | null {
  const m = widgetMeta(type);
  if (!m || items.length >= MAX_WIDGETS) return null;
  const base: WidgetItem = { id: newWidgetId(items, type), type: type as WidgetType, x: 0, y: 0, w: m.w, h: m.h, theme };
  for (let y = 0; y < 200; y++) {
    for (let x = 0; x <= GRID_COLS - base.w; x++) {
      const spot = { ...base, x, y };
      if (!items.some((i) => hit(i, spot))) return settle([...items, spot]);
    }
  }
  return null;
}

/** How many rows the layout is tall. */
export const rowsOf = (items: readonly WidgetItem[]): number => items.reduce((n, i) => Math.max(n, i.y + i.h), 0);

/** Does the layout fit the board's rows? The Overview never scrolls, so a layout may not be taller than FIT_ROWS. */
export const fitsBoard = (items: readonly WidgetItem[]): boolean => rowsOf(items) <= FIT_ROWS;

/** One step of making room: the widget that can give the most height gives one row; when none can, the one that can give the most width gives one
 *  column. Null when every widget is already as small as it may be. */
export function shrinkOne(items: readonly WidgetItem[]): WidgetItem[] | null {
  const room = (i: WidgetItem, by: "h" | "w") => {
    const m = widgetMeta(i.type)!;
    return by === "h" ? i.h - m.minH : i.w - m.minW;
  };
  for (const by of ["h", "w"] as const) {
    const pick = items.filter((i) => room(i, by) > 0).sort((a, b) => room(b, by) - room(a, by) || b.w * b.h - a.w * a.h)[0];
    if (pick) return settle(items.map((i) => (i.id === pick.id ? { ...i, [by]: i[by] - 1 } : i)));
  }
  return null;
}

/** A layout squeezed into the board: widgets give up rows and columns until it fits; if even the smallest sizes do not fit, the last ones are dropped. */
export function fitToBoard(items: readonly WidgetItem[]): WidgetItem[] {
  let cur = settle(items);
  for (let guard = 0; guard < 300 && !fitsBoard(cur); guard++) {
    const smaller = shrinkOne(cur);
    if (smaller) cur = smaller;
    else {
      const last = [...cur].sort((a, b) => b.y + b.h - (a.y + a.h) || b.x - a.x)[0];
      cur = settle(cur.filter((i) => i.id !== last.id));
    }
  }
  return cur;
}

/** The first free spot of this size inside the board (reading left to right, top to bottom), or null. */
function freeSpot(items: readonly WidgetItem[], type: WidgetType, w: number, h: number, theme: WidgetTheme): WidgetItem[] | null {
  const base: WidgetItem = { id: newWidgetId(items, type), type, x: 0, y: 0, w, h, theme };
  for (let y = 0; y + h <= FIT_ROWS; y++) {
    for (let x = 0; x <= GRID_COLS - w; x++) {
      const spot = { ...base, x, y };
      if (!items.some((i) => hit(i, spot))) return settle([...items, spot]);
    }
  }
  return null;
}

/**
 * Adds a widget to a board that must not grow: it goes in the first free spot at its first size; when there is none, the other widgets give up rows
 * and columns (the biggest first, never below their smallest size) until it fits; when even that is not enough, it is tried smaller. Null when the
 * board cannot hold it (or already holds MAX_WIDGETS).
 */
export function addWidgetFitting(items: readonly WidgetItem[], type: string, theme: WidgetTheme = "default"): WidgetItem[] | null {
  const m = widgetMeta(type);
  if (!m || items.length >= MAX_WIDGETS) return null;
  const t = type as WidgetType;
  let cur: WidgetItem[] = settle(items);
  for (let guard = 0; guard < 300; guard++) {
    const placed = freeSpot(cur, t, m.w, m.h, theme);
    if (placed) return placed;
    const smaller = shrinkOne(cur);
    if (!smaller) break;
    cur = smaller;
  }
  // everything is as small as it goes: the new one may be smaller than its first size
  const sizes: [number, number][] = [];
  for (let w = m.w; w >= m.minW; w--) for (let h = m.h; h >= m.minH; h--) sizes.push([w, h]);
  sizes.sort((a, b) => b[0] * b[1] - a[0] * a[1]);
  for (const [w, h] of sizes) {
    const placed = freeSpot(cur, t, w, h, theme);
    if (placed) return placed;
  }
  return null;
}

// ---- the default, and reading from storage ----------------------------------------------------------------------------------------------

/**
 * The layout everybody starts with: it looks like the Overview always did: two cards each side of the energy flow. `cards` are the four the
 * customer had picked before widgets existed (solar, grid, load, battery unless they chose others). A site with an EV charger gets its four
 * charger widgets under them.
 */
export function defaultLayout(cards: readonly string[], withCharger: boolean): WidgetItem[] {
  const four = cards.filter(isWidgetType).slice(0, 4);
  const pick = (i: number): WidgetType => (four[i] ?? (["solar", "grid", "load", "battery"] as const)[i]) as WidgetType;
  const tall = withCharger ? 4 : 6;
  const w = (id: WidgetType, x: number, y: number, ww: number, h: number): WidgetItem => ({ id: `${id}-1`, type: id, x, y, w: ww, h, theme: "default" });
  const items: WidgetItem[] = [w(pick(0), 0, 0, 3, tall), w(pick(1), 0, tall, 3, tall), w("flow", 3, 0, 6, FIT_ROWS), w(pick(2), 9, 0, 3, tall), w(pick(3), 9, tall, 3, tall)];
  if (withCharger) items.push(w("ev_power", 0, 8, 3, 2), w("ev_current", 0, 10, 3, 2), w("ev_temp", 9, 8, 3, 2), w("ev_energy", 9, 10, 3, 2));
  return settle(items);
}

/** The layout stored in ui_preferences, checked item by item; null when there is none (the caller then uses defaultLayout). */
export function parseLayout(raw: unknown): WidgetItem[] | null {
  const root = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const list = root.overview_layout && typeof root.overview_layout === "object" ? (root.overview_layout as Record<string, unknown>).items : undefined;
  if (!Array.isArray(list)) return null;
  const seen = new Set<string>();
  const items: WidgetItem[] = [];
  for (const entry of list.slice(0, MAX_WIDGETS)) {
    const o = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
    if (!isWidgetType(o.type)) continue;
    const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
    const id = typeof o.id === "string" && /^[a-z_]+-\d{1,3}$/.test(o.id) && !seen.has(o.id) ? o.id : newWidgetId(items, o.type);
    seen.add(id);
    const m = widgetMeta(o.type)!;
    items.push(fit({ id, type: o.type, x: num(o.x, 0), y: num(o.y, 0), w: num(o.w, m.w), h: num(o.h, m.h), theme: isWidgetTheme(o.theme) ? o.theme : "default" }));
  }
  return fitToBoard(items);
}

/** What is stored: only the fields that matter, in a stable order. */
export function layoutToJson(items: readonly WidgetItem[]): { v: 1; items: WidgetItem[] } {
  return { v: 1, items: settle(items).map(({ id, type, x, y, w, h, theme }) => ({ id, type, x, y, w, h, theme })) };
}
