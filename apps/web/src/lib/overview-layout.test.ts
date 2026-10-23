import { describe, expect, it } from "vitest";
import { FIT_ROWS, GRID_COLS, MAX_WIDGETS, addWidget, addWidgetFitting, defaultLayout, fitToBoard, fitsBoard, shrinkOne, widgetMeta, layoutToJson, moveWidget, parseLayout, removeWidget, resizeWidget, rowsOf, settle, themeWidget, type WidgetItem } from "./overview-layout";

const overlap = (a: WidgetItem, b: WidgetItem) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** A layout is tidy when nothing overlaps, nothing leaves the board, and nothing could rise any further. */
function expectTidy(items: WidgetItem[]) {
  for (const a of items) {
    expect(a.x).toBeGreaterThanOrEqual(0);
    expect(a.x + a.w).toBeLessThanOrEqual(GRID_COLS);
    expect(a.y).toBeGreaterThanOrEqual(0);
    for (const b of items) if (a !== b) expect(overlap(a, b), `${a.id} overlaps ${b.id}`).toBe(false);
    if (a.y > 0) expect(items.some((b) => b !== a && overlap(b, { ...a, y: a.y - 1 })), `${a.id} could rise`).toBe(true);
  }
}

const item = (id: string, type: WidgetItem["type"], x: number, y: number, w: number, h: number): WidgetItem => ({ id, type, x, y, w, h, theme: "default" });
const at = (items: WidgetItem[], id: string) => items.find((i) => i.id === id)!;

describe("defaultLayout", () => {
  it("looks like the Overview always did: two cards, the flow, two cards, and fits the screen's rows", () => {
    const l = defaultLayout(["solar", "grid", "load", "battery"], false);
    expect(l.map((i) => i.type)).toEqual(["solar", "grid", "flow", "load", "battery"]);
    expect(rowsOf(l)).toBe(FIT_ROWS);
    expectTidy(l);
  });

  it("puts the four charger widgets under the cards, still inside the same rows", () => {
    const l = defaultLayout(["solar", "grid", "load", "battery"], true);
    expect(l).toHaveLength(9);
    expect(rowsOf(l)).toBe(FIT_ROWS);
    expectTidy(l);
  });

  it("uses the four cards the customer had picked, and ignores junk", () => {
    expect(defaultLayout(["selfpowered", "exported", "nonsense", "imported", "load"], false).map((i) => i.type)).toEqual(["selfpowered", "exported", "flow", "imported", "load"]);
  });
});

describe("moving", () => {
  const start = defaultLayout(["solar", "grid", "load", "battery"], false);

  it("keeps everything tidy and puts the widget where it was dropped when there is room", () => {
    const two = [item("a-1", "solar", 0, 0, 3, 3), item("b-1", "grid", 3, 0, 3, 3)];
    const moved = moveWidget(two, "a-1", 6, 0);
    expect(at(moved, "a-1")).toMatchObject({ x: 6, y: 0 });
    expectTidy(moved);
  });

  it("pushes the widget it lands on down instead of overlapping it", () => {
    const moved = moveWidget(start, "load-1", 0, 0);
    expect(at(moved, "load-1")).toMatchObject({ x: 0, y: 0 });
    expectTidy(moved);
    expect(at(moved, "solar-1").y).toBeGreaterThan(0);
  });

  it("never lets a widget leave the board", () => {
    const moved = moveWidget(start, "solar-1", 99, -4);
    expect(at(moved, "solar-1").x).toBe(GRID_COLS - at(moved, "solar-1").w);
    expect(at(moved, "solar-1").y).toBeGreaterThanOrEqual(0);
    expectTidy(moved);
  });

  it("lets a dropped widget rise to fill a hole instead of floating", () => {
    const moved = moveWidget([item("a-1", "solar", 0, 0, 3, 3), item("b-1", "grid", 3, 0, 3, 3)], "b-1", 3, 20);
    expect(at(moved, "b-1").y).toBe(0);
  });

  it("is a no-op for an unknown id", () => {
    expect(moveWidget(start, "nope-1", 2, 2)).toEqual(start);
  });
});

describe("resizing", () => {
  const start = defaultLayout(["solar", "grid", "load", "battery"], false);

  it("stays inside the smallest and largest size of the kind", () => {
    const tiny = resizeWidget(start, "solar-1", 1, 1);
    expect(at(tiny, "solar-1")).toMatchObject({ w: 2, h: 3 });
    const huge = resizeWidget(start, "solar-1", 50, 50);
    expect(at(huge, "solar-1")).toMatchObject({ w: 6, h: 8 });
    expectTidy(tiny);
    expectTidy(huge);
  });

  it("makes room for a widget that grows, and closes the gap when it shrinks", () => {
    const big = resizeWidget(start, "solar-1", 6, 6);
    expectTidy(big);
    const small = resizeWidget(big, "solar-1", 2, 3);
    expectTidy(small);
    expect(rowsOf(small)).toBeLessThanOrEqual(rowsOf(big));
  });

  it("does not push a widget past the right edge when stretched from the right side", () => {
    const l = resizeWidget([item("a-1", "solar", 9, 0, 3, 3)], "a-1", 6, 3);
    expect(at(l, "a-1").x + at(l, "a-1").w).toBeLessThanOrEqual(GRID_COLS);
  });
});

describe("adding, removing, themes", () => {
  it("adds a widget in the first free spot, at its first size", () => {
    const l = addWidget(defaultLayout(["solar", "grid", "load", "battery"], false), "clock");
    expect(l).not.toBeNull();
    const clock = l!.find((i) => i.type === "clock")!;
    expect(clock).toMatchObject({ id: "clock-1", w: 3, h: 2 });
    expectTidy(l!);
  });

  it("gives a second widget of the same kind its own id", () => {
    const one = addWidget([], "clock")!;
    const two = addWidget(one, "clock")!;
    expect(two.map((i) => i.id).sort()).toEqual(["clock-1", "clock-2"]);
  });

  it("refuses an unknown kind and a full board", () => {
    expect(addWidget([], "nonsense")).toBeNull();
    let l: WidgetItem[] = [];
    for (let n = 0; n < MAX_WIDGETS; n++) l = addWidget(l, "clock")!;
    expect(l).toHaveLength(MAX_WIDGETS);
    expect(addWidget(l, "clock")).toBeNull();
  });

  it("closes the hole when one is removed", () => {
    const l = removeWidget(defaultLayout(["solar", "grid", "load", "battery"], false), "solar-1");
    expect(l.find((i) => i.id === "solar-1")).toBeUndefined();
    expectTidy(l);
    expect(at(l, "grid-1").y).toBe(0);
  });

  it("changes only the theme of the one widget", () => {
    const base = defaultLayout(["solar", "grid", "load", "battery"], false);
    const l = themeWidget(base, "grid-1", "ocean");
    expect(at(l, "grid-1").theme).toBe("ocean");
    expect(l.filter((i) => i.theme !== "default")).toHaveLength(1);
  });
});

describe("settle", () => {
  it("is stable: settling a tidy layout changes nothing", () => {
    const l = defaultLayout(["solar", "grid", "load", "battery"], true);
    expect(settle(l)).toEqual(l);
  });

  it("untangles widgets stacked on the same cell", () => {
    const l = settle([item("a-1", "solar", 0, 0, 3, 3), item("b-1", "grid", 0, 0, 3, 3), item("c-1", "load", 1, 1, 3, 3)]);
    expectTidy(l);
  });
});

describe("parseLayout / layoutToJson", () => {
  it("returns null when nothing usable is stored", () => {
    expect(parseLayout(null)).toBeNull();
    expect(parseLayout({})).toBeNull();
    expect(parseLayout({ overview_layout: "x" })).toBeNull();
    expect(parseLayout({ overview_layout: { items: "x" } })).toBeNull();
  });

  it("round-trips what it stores", () => {
    const base = themeWidget(defaultLayout(["solar", "grid", "load", "battery"], true), "flow-1", "graphite");
    const back = parseLayout({ overview_layout: layoutToJson(base) })!;
    expect(back).toEqual(base);
  });

  it("drops unknown kinds, repairs bad numbers and themes, and never returns an untidy layout", () => {
    const l = parseLayout({
      overview_layout: {
        items: [
          { id: "solar-1", type: "solar", x: -5, y: "no", w: 99, h: 0, theme: "pink" },
          { id: "solar-1", type: "grid", x: 0, y: 0, w: 3, h: 4, theme: "ocean" },
          { id: "x-1", type: "hacker", x: 0, y: 0, w: 3, h: 3 },
          null,
          "junk",
        ],
      },
    })!;
    expect(l).toHaveLength(2);
    expect(l[0]).toMatchObject({ type: "solar", theme: "default", w: 6, h: 3 });
    expect(new Set(l.map((i) => i.id)).size).toBe(2);
    expectTidy(l);
  });

  it("keeps no more than the most widgets", () => {
    const items = Array.from({ length: 40 }, (_, n) => ({ id: `clock-${n + 1}`, type: "clock", x: 0, y: n, w: 2, h: 1 }));
    expect(parseLayout({ overview_layout: { items } })!.length).toBeLessThanOrEqual(MAX_WIDGETS);
  });
});

describe("a board that never grows", () => {
  const full = defaultLayout(["solar", "grid", "load", "battery"], false);

  it("fits exactly: the standard layout fills the rows and no more", () => {
    expect(fitsBoard(full)).toBe(true);
    expect(rowsOf(full)).toBe(FIT_ROWS);
  });

  it("makes room for a new widget by shrinking the others, and the board is still no taller", () => {
    const l = addWidgetFitting(full, "clock");
    expect(l).not.toBeNull();
    expect(l!.find((i) => i.type === "clock")).toMatchObject({ w: 3, h: 2 });
    expect(fitsBoard(l!)).toBe(true);
    expect(l).toHaveLength(full.length + 1);
    expectTidy(l!);
    // somebody gave up room, and nobody went below their smallest size
    expect(l!.some((i) => i.type !== "clock" && (i.w < full.find((f) => f.id === i.id)!.w || i.h < full.find((f) => f.id === i.id)!.h))).toBe(true);
    for (const i of l!) {
      const m = widgetMeta(i.type)!;
      expect(i.w).toBeGreaterThanOrEqual(m.minW);
      expect(i.h).toBeGreaterThanOrEqual(m.minH);
    }
  });

  it("takes the biggest widget's rows first (the energy flow before the small cards)", () => {
    const l = addWidgetFitting(full, "clock")!;
    expect(l.find((i) => i.type === "flow")!.h).toBeLessThan(FIT_ROWS);
    expect(l.find((i) => i.id === "solar-1")!.h).toBe(full.find((i) => i.id === "solar-1")!.h);
  });

  it("uses a free spot without touching anything when there is one", () => {
    const small = [{ id: "clock-1", type: "clock", x: 0, y: 0, w: 3, h: 2, theme: "default" }] as WidgetItem[];
    const l = addWidgetFitting(small, "battery")!;
    expect(l.find((i) => i.id === "clock-1")).toEqual(small[0]);
    expect(fitsBoard(l)).toBe(true);
  });

  it("can keep adding until the board is really full, always staying inside it", () => {
    let l: WidgetItem[] = full;
    let added = 0;
    for (let n = 0; n < 40; n++) {
      const next = addWidgetFitting(l, "clock");
      if (!next) break;
      l = next;
      added++;
      expect(fitsBoard(l)).toBe(true);
      expectTidy(l);
    }
    expect(added).toBeGreaterThan(3);
    expect(addWidgetFitting(l, "clock")).toBeNull();
  });

  it("refuses an unknown kind", () => {
    expect(addWidgetFitting(full, "nonsense")).toBeNull();
  });

  it("shrinkOne gives up one row or column, and is null when everything is at its smallest", () => {
    const one = shrinkOne(full)!;
    expect(one.reduce((n, i) => n + i.w * i.h, 0)).toBe(full.reduce((n, i) => n + i.w * i.h, 0) - (full.find((i) => i.type === "flow")!.w));
    let l: WidgetItem[] | null = full;
    for (let n = 0; n < 200 && l; n++) {
      const next = shrinkOne(l);
      if (!next) break;
      l = next;
    }
    expect(shrinkOne(l!)).toBeNull();
  });

  it("fitToBoard squeezes a layout that is too tall, and keeps one that fits", () => {
    const tall = [item("solar-1", "solar", 0, 0, 3, 8), item("grid-1", "grid", 0, 8, 3, 8), item("flow-1", "flow", 3, 0, 6, 14)];
    const l = fitToBoard(tall);
    expect(fitsBoard(l)).toBe(true);
    expect(l).toHaveLength(3);
    expect(fitToBoard(full)).toEqual(full);
  });

  it("a stored layout that was too tall for the board is squeezed when it is read", () => {
    const stored = { overview_layout: { items: [{ id: "flow-1", type: "flow", x: 0, y: 0, w: 12, h: 14, theme: "default" }, { id: "clock-1", type: "clock", x: 0, y: 14, w: 3, h: 2, theme: "default" }] } };
    expect(fitsBoard(parseLayout(stored)!)).toBe(true);
  });
});
