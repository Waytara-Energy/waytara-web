// Geometry of the Overview energy-flow diagram, kept apart from the React component so it can be tested.
//
// A hub (the inverter) sits in the middle. Nodes are placed on four sides by role: sources on the left (grid,
// generator), solar on top, storage underneath (batteries, UPS) and consumers on the right (home, EV chargers).
// Any number of nodes per side is spread evenly, so extra batteries, chargers or a generator just take their place.
// Every connector is a cubic curve that leaves the hub and enters the node on the circle's edge, tangent to the side
// it leaves from, so the lines always meet the circles cleanly.

export type NodeKind = "solar" | "grid" | "generator" | "battery" | "ups" | "home" | "ev";
export type Side = "top" | "left" | "bottom" | "right";

/** Which side of the hub a kind of node lives on. */
export const SIDE_OF: Record<NodeKind, Side> = {
  solar: "top",
  grid: "left",
  generator: "left",
  battery: "bottom",
  ups: "bottom",
  home: "right",
  ev: "right",
};

/** Order within a side (first = nearest the top / left). */
const ORDER: Record<NodeKind, number> = { solar: 0, grid: 0, generator: 1, battery: 0, ups: 1, home: 0, ev: 1 };

export interface Point {
  x: number;
  y: number;
}

export const VIEW_W = 640;
export const NODE_R = 30;
export const HUB_R = 38;
const HUB_X = VIEW_W / 2;
const SIDE_X = 92; // centre of the left column (the right column mirrors it)
const ROW_GAP = 124; // between nodes stacked on the left / right
const COL_GAP = 120; // between nodes side by side on the top / bottom
const MAX_PER_ROW = 4; // more than this wraps onto another row
const ROW_PITCH = 104; // between wrapped rows
const TOP_BOTTOM_DIST = 150; // hub centre to the first top / bottom row
const TEXT_BELOW = 46; // room for a node's value + label under its circle
const TEXT_ABOVE = 46;
const EDGE_PAD = 8;

export interface LaidOutNode<T> {
  item: T;
  side: Side;
  center: Point;
  /** Where the connector meets the node's circle. */
  anchor: Point;
  /** Where the connector leaves the hub's circle. */
  hubAnchor: Point;
}

export interface Layout<T> {
  width: number;
  height: number;
  hub: Point;
  nodes: LaidOutNode<T>[];
}

function spread(count: number, index: number, gap: number): number {
  return (index - (count - 1) / 2) * gap;
}

/** Lay the nodes out. `kindOf` tells the engine which role each item plays. */
export function layoutFlow<T>(items: T[], kindOf: (item: T) => NodeKind): Layout<T> {
  const bySide: Record<Side, T[]> = { top: [], left: [], bottom: [], right: [] };
  for (const item of items) bySide[SIDE_OF[kindOf(item)]].push(item);
  for (const side of Object.keys(bySide) as Side[]) bySide[side].sort((a, b) => ORDER[kindOf(a)] - ORDER[kindOf(b)]);

  const rowsOf = (n: number) => Math.ceil(n / MAX_PER_ROW);
  const hasTop = bySide.top.length > 0;
  const hasBottom = bySide.bottom.length > 0;
  const maxRows = Math.max(bySide.left.length, bySide.right.length, 1);
  const lrHalf = ((maxRows - 1) * ROW_GAP) / 2;
  // The first top / bottom row must clear the lowest / highest node of the side columns when those are crowded.
  const firstRowDist = Math.max(TOP_BOTTOM_DIST, lrHalf > 0 ? lrHalf + NODE_R * 2 + TEXT_BELOW : 0);
  const topDist = hasTop ? firstRowDist + (rowsOf(bySide.top.length) - 1) * ROW_PITCH : 0;
  const bottomDist = hasBottom ? firstRowDist + (rowsOf(bySide.bottom.length) - 1) * ROW_PITCH : 0;
  // Hub y is measured from the top of the content, which starts at the highest circle (plus its label when it's above).
  const upExtent = Math.max(topDist, lrHalf);
  const downExtent = Math.max(bottomDist, lrHalf);
  const topPad = hasTop && topDist >= lrHalf ? NODE_R + TEXT_ABOVE : NODE_R + EDGE_PAD;
  const bottomPad = NODE_R + TEXT_BELOW;
  const hub: Point = { x: HUB_X, y: topPad + upExtent };
  const height = hub.y + downExtent + bottomPad;

  const nodes: LaidOutNode<T>[] = [];
  (Object.keys(bySide) as Side[]).forEach((side) => {
    const list = bySide[side];
    list.forEach((item, i) => {
      const n = list.length;
      let center: Point;
      let anchor: Point;
      let hubAnchor: Point;
      // Where the connectors leave the hub: a small fan so several lines on one side don't stack on one pixel.
      const fan = Math.max(-HUB_R * 0.55, Math.min(HUB_R * 0.55, spread(n, i, 14)));
      if (side === "left" || side === "right") {
        const sign = side === "left" ? -1 : 1;
        center = { x: HUB_X + sign * (HUB_X - SIDE_X), y: hub.y + spread(n, i, ROW_GAP) };
        anchor = { x: center.x - sign * NODE_R, y: center.y };
        hubAnchor = { x: hub.x + sign * Math.sqrt(HUB_R ** 2 - fan ** 2), y: hub.y + fan };
      } else {
        const sign = side === "top" ? -1 : 1;
        const row = Math.floor(i / MAX_PER_ROW);
        const inRow = Math.min(MAX_PER_ROW, n - row * MAX_PER_ROW);
        const colGap = Math.min(COL_GAP, (HUB_X - SIDE_X - NODE_R - 40) / Math.max(1, (inRow - 1) / 2));
        center = { x: HUB_X + spread(inRow, i - row * MAX_PER_ROW, colGap), y: hub.y + sign * (firstRowDist + row * ROW_PITCH) };
        anchor = { x: center.x, y: center.y - sign * NODE_R };
        hubAnchor = { x: hub.x + fan, y: hub.y + sign * Math.sqrt(HUB_R ** 2 - fan ** 2) };
      }
      nodes.push({ item, side, center, anchor, hubAnchor });
    });
  });
  return { width: VIEW_W, height, hub, nodes };
}

/** A smooth connector from `from` to `to`, tangent to the axis it travels along (so it enters circles head-on). */
export function curvePath(from: Point, to: Point, vertical: boolean): string {
  const f = (n: number) => Math.round(n * 100) / 100;
  if (vertical) {
    const my = (from.y + to.y) / 2;
    return `M ${f(from.x)} ${f(from.y)} C ${f(from.x)} ${f(my)}, ${f(to.x)} ${f(my)}, ${f(to.x)} ${f(to.y)}`;
  }
  const mx = (from.x + to.x) / 2;
  return `M ${f(from.x)} ${f(from.y)} C ${f(mx)} ${f(from.y)}, ${f(mx)} ${f(to.y)}, ${f(to.x)} ${f(to.y)}`;
}
