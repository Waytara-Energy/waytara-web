"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, GripVertical, LayoutGrid, Palette, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { notify } from "@waytara/ui/notify";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ButtonSpinner } from "@/components/ui/spinner";
import {
  FIT_ROWS,
  GRID_COLS,
  MAX_WIDGETS,
  WIDGETS,
  WIDGET_GROUPS,
  WIDGET_THEMES,
  addWidget,
  moveWidget,
  removeWidget,
  resizeWidget,
  rowsOf,
  themeWidget,
  widgetMeta,
  type WidgetItem,
  type WidgetTheme,
} from "@/lib/overview-layout";
import { saveOverviewLayout } from "@/app/dashboard/settings/actions";
import { cn } from "@/lib/utils";
import { OverviewBackdrop } from "./overview-backdrop";
import { WidgetBody, type WidgetContext } from "./overview-widgets";

type Gesture = { kind: "move" | "resize"; id: string; px: number; py: number; dx: number; dy: number; colStep: number; rowStep: number; start: WidgetItem };

/**
 * The Overview as a board of widgets. Everybody sees the board; "Customize" turns it into an editor, like the home screen of a phone: drag a
 * widget to move it (the others make room and nothing overlaps or leaves a hole), pull its corner to make it bigger or smaller, pick a colour
 * theme for it, take it away, or add one from the list. Done saves it for this customer; Cancel throws the changes away. The arrow keys move a
 * focused widget (with Shift they resize it), so it does not need a mouse. Editing needs the wide layout; on a phone the widgets stack.
 */
export function OverviewCanvas({
  layout,
  defaults,
  ctx,
  background,
  startEditing,
}: {
  /** what to show: the customer's saved layout, or the standard one */
  layout: WidgetItem[];
  /** the standard layout (what Reset brings back) */
  defaults: WidgetItem[];
  ctx: WidgetContext;
  /** the CSS of the picture or gradient behind the page, or null */
  background: string | null;
  startEditing: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = React.useState(layout);
  const [seen, setSeen] = React.useState(layout);
  if (layout !== seen) {
    setSeen(layout);
    setItems(layout);
  }
  const [draft, setDraft] = React.useState<WidgetItem[] | null>(startEditing ? layout : null);
  const [gesture, setGesture] = React.useState<Gesture | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const board = React.useRef<HTMLDivElement>(null);
  const probe = React.useRef<HTMLDivElement>(null);

  const editing = draft !== null;
  const base = draft ?? items;

  // while a widget is being dragged or stretched, everything else shows where it would go
  const shown = React.useMemo(() => {
    if (!gesture) return base;
    const { start, dx, dy, colStep, rowStep } = gesture;
    const cx = Math.round(dx / colStep);
    const cy = Math.round(dy / rowStep);
    return gesture.kind === "move" ? moveWidget(base, gesture.id, start.x + cx, start.y + cy) : resizeWidget(base, gesture.id, start.w + cx, start.h + cy);
  }, [base, gesture]);

  const available = { inverter: ctx.solar !== null, charger: ctx.ev !== null };
  const rows = Math.max(rowsOf(shown) + (editing ? 2 : 0), FIT_ROWS);

  function begin(kind: Gesture["kind"], id: string, e: React.PointerEvent<HTMLElement>) {
    if (e.button !== 0 || !board.current || !probe.current) return;
    const item = base.find((i) => i.id === id);
    if (!item) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const gap = probe.current.getBoundingClientRect().width;
    const row = probe.current.getBoundingClientRect().height;
    const colStep = (board.current.getBoundingClientRect().width - (GRID_COLS - 1) * gap) / GRID_COLS + gap;
    setGesture({ kind, id, px: e.clientX, py: e.clientY, dx: 0, dy: 0, colStep, rowStep: row + gap, start: item });
  }
  function track(e: React.PointerEvent<HTMLElement>) {
    setGesture((g) => (g ? { ...g, dx: e.clientX - g.px, dy: e.clientY - g.py } : g));
  }
  function finish() {
    if (gesture) setDraft(shown);
    setGesture(null);
  }

  function key(id: string, e: React.KeyboardEvent<HTMLElement>) {
    const item = base.find((i) => i.id === id);
    if (!item || !draft) return;
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (d) {
      e.preventDefault();
      setDraft(e.shiftKey ? resizeWidget(draft, id, item.w + d[0], item.h + d[1]) : moveWidget(draft, id, item.x + d[0], item.y + d[1]));
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      setDraft(removeWidget(draft, id));
    }
  }

  function add(type: string) {
    const next = draft ? addWidget(draft, type) : null;
    if (!next) {
      notify.error(`The board holds ${MAX_WIDGETS} widgets at most.`);
      return;
    }
    setDraft(next);
    notify.success(`${widgetMeta(type)?.label ?? "Widget"} added.`);
  }

  async function done() {
    if (!draft) return;
    if (JSON.stringify(draft) === JSON.stringify(items)) {
      setDraft(null);
      return;
    }
    setSaving(true);
    try {
      await saveOverviewLayout(draft);
      setItems(draft);
      setDraft(null);
      notify.success("Overview saved.");
      router.refresh();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cn(editing && "pb-24")}>
      {background && <OverviewBackdrop css={background} />}

      <div
        ref={board}
        className="ov-board"
        data-bg={background ? "true" : undefined}
        data-editing={editing ? "true" : undefined}
        style={{ "--rows": rows } as React.CSSProperties}
      >
        {/* measures a gap and a row in pixels (they depend on the screen and the text size) */}
        <div ref={probe} aria-hidden className="pointer-events-none invisible absolute left-0 top-0" style={{ width: "var(--gap)", height: "var(--row)" }} />

        {shown.map((item) => {
          const meta = widgetMeta(item.type)!;
          const dragged = gesture?.kind === "move" && gesture.id === item.id;
          // a dragged widget stays where it was lifted and follows the pointer; the others use the previewed places
          const place = dragged ? gesture.start : item;
          return (
            <div
              key={item.id}
              className="ov-item"
              data-type={item.type}
              data-wide={item.w >= 6 ? "true" : undefined}
              data-drag={dragged ? "true" : undefined}
              style={{ "--x": place.x, "--y": place.y, "--w": place.w, "--h": place.h, ...(dragged ? { transform: `translate(${gesture.dx}px, ${gesture.dy}px)` } : {}) } as React.CSSProperties}
            >
              <div className={cn("ov-face", dragged && "shadow-2xl ring-2 ring-primary")} data-theme={item.theme}>
                <WidgetBody type={item.type} ctx={ctx} />
              </div>

              {editing && (
                <>
                  <div
                    role="group"
                    tabIndex={0}
                    aria-label={`${meta.label}. Use the arrow keys to move it, Shift and the arrow keys to resize it, Delete to remove it.`}
                    className={cn("absolute inset-0 z-10 cursor-grab touch-none rounded-2xl outline-none ring-2 ring-primary/40 focus-visible:ring-primary", dragged && "cursor-grabbing ring-primary", "bg-background/10 backdrop-blur-[1px]")}
                    onPointerDown={(e) => begin("move", item.id, e)}
                    onPointerMove={gesture?.id === item.id ? track : undefined}
                    onPointerUp={finish}
                    onPointerCancel={() => setGesture(null)}
                    onKeyDown={(e) => key(item.id, e)}
                  />
                  <span className="pointer-events-none absolute left-2 top-2 z-20 flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground shadow">
                    <GripVertical className="size-3" />
                    {meta.label}
                  </span>
                  <div className="absolute right-2 top-2 z-20 flex gap-1">
                    <ThemePicker value={item.theme} onPick={(t) => setDraft((d) => (d ? themeWidget(d, item.id, t) : d))} />
                    <button
                      type="button"
                      aria-label={`Remove ${meta.label}`}
                      onClick={() => setDraft((d) => (d ? removeWidget(d, item.id) : d))}
                      className="grid size-7 place-items-center rounded-full bg-background text-destructive shadow ring-1 ring-border outline-none hover:bg-destructive hover:text-white focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  <span className="pointer-events-none absolute bottom-2 left-2 z-20 rounded-full bg-background/90 px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground shadow ring-1 ring-border">
                    {item.w} × {item.h}
                  </span>
                  <span
                    role="presentation"
                    aria-hidden
                    onPointerDown={(e) => begin("resize", item.id, e)}
                    onPointerMove={gesture?.id === item.id ? track : undefined}
                    onPointerUp={finish}
                    onPointerCancel={() => setGesture(null)}
                    className="absolute bottom-1 right-1 z-20 grid size-7 cursor-nwse-resize touch-none place-items-center rounded-full bg-primary text-primary-foreground shadow"
                  >
                    <svg viewBox="0 0 10 10" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                      <path d="M9 3 3 9M9 6 6 9" />
                    </svg>
                  </span>
                </>
              )}
            </div>
          );
        })}

        {/* where a dragged widget will land */}
        {gesture?.kind === "move" &&
          (() => {
            const target = shown.find((i) => i.id === gesture.id);
            return target ? (
              <div aria-hidden className="ov-item pointer-events-none rounded-2xl border-2 border-dashed border-primary/60 bg-primary/10" style={{ "--x": target.x, "--y": target.y, "--w": target.w, "--h": target.h } as React.CSSProperties} />
            ) : null;
          })()}
      </div>

      {!editing && (
        <Button type="button" size="sm" className="fixed bottom-6 right-6 z-30 hidden rounded-full shadow-lg lg:inline-flex" onClick={() => setDraft(items)}>
          <LayoutGrid className="size-4" />
          Customize
        </Button>
      )}

      {editing && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-card/95 p-1.5 shadow-xl backdrop-blur" role="toolbar" aria-label="Customize the Overview">
          <Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            Add widget
          </Button>
          <Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={() => setDraft(defaults)}>
            <RotateCcw className="size-4" />
            Reset
          </Button>
          <span className="mx-1 h-5 w-px bg-border" />
          <Button type="button" size="sm" variant="ghost" className="rounded-full" disabled={saving} onClick={() => setDraft(null)}>
            <X className="size-4" />
            Cancel
          </Button>
          <Button type="button" size="sm" className="rounded-full" disabled={saving || draft.length === 0} onClick={() => void done()}>
            <ButtonSpinner show={saving} />
            {!saving && <Check className="size-4" />}
            {saving ? "Saving…" : "Done"}
          </Button>
        </div>
      )}

      <Sheet open={adding} onOpenChange={setAdding}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Add a widget</SheetTitle>
            <SheetDescription>It lands in the first free spot. Drag it where you want it, and stretch it from its corner.</SheetDescription>
          </SheetHeader>
          <div className="space-y-6 px-4 pb-6">
            {WIDGET_GROUPS.map((group) => {
              const list = WIDGETS.filter((w) => w.group === group && (w.needs === null || available[w.needs]));
              if (list.length === 0) return null;
              return (
                <section key={group}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</h3>
                  <ul className="space-y-2">
                    {list.map((w) => (
                      <li key={w.type} className="flex items-center gap-3 rounded-xl border border-border p-3">
                        <div className="grid h-12 w-14 shrink-0 place-items-center rounded-lg bg-muted">
                          <span className="rounded-sm border-2 border-primary/60 bg-primary/10" style={{ width: `${(w.w / 12) * 100 * 2.2}%`, maxWidth: "100%", aspectRatio: `${w.w} / ${w.h}`, maxHeight: "100%" }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{w.label}</p>
                          <p className="text-xs text-muted-foreground">{w.hint}</p>
                        </div>
                        <Button type="button" size="sm" variant="outline" onClick={() => add(w.type)}>
                          <Plus className="size-3.5" />
                          Add
                        </Button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ThemePicker({ value, onPick }: { value: WidgetTheme; onPick: (t: WidgetTheme) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Colour theme" className="grid size-7 place-items-center rounded-full bg-background text-foreground shadow ring-1 ring-border outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
          <Palette className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Colour theme</p>
        <div className="grid grid-cols-4 gap-2">
          {WIDGET_THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              title={t.label}
              aria-label={t.label}
              aria-pressed={value === t.id}
              onClick={() => onPick(t.id)}
              className={cn("relative grid size-9 place-items-center rounded-lg border outline-none focus-visible:ring-2 focus-visible:ring-ring", value === t.id ? "border-primary ring-2 ring-primary/40" : "border-border")}
              style={{ background: t.swatch }}
            >
              {value === t.id && <Check className={cn("size-4", t.id === "default" || t.id === "glass" ? "text-foreground" : "text-white")} />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
