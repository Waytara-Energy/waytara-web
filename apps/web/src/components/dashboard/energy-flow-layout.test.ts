import { describe, expect, it } from "vitest";
import { COMPACT_HUB_R, COMPACT_NODE_R, compactLayout, curvePath, HUB_R, layoutFlow, NODE_R, SIDE_OF, VIEW_W, type NodeKind } from "./energy-flow-layout";

const lay = (kinds: NodeKind[]) => layoutFlow(kinds, (k) => k);
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe("layoutFlow", () => {
  it("puts each role on its own side", () => {
    const l = lay(["solar", "grid", "battery", "home"]);
    const side = (k: NodeKind) => l.nodes.find((n) => n.item === k)!.side;
    expect((["solar", "grid", "battery", "home"] as NodeKind[]).map(side)).toEqual(["top", "left", "bottom", "right"]);
    expect(SIDE_OF.ev).toBe("right");
  });

  it("connectors start on the hub circle and end on the node circle", () => {
    const l = lay(["solar", "grid", "generator", "battery", "battery", "ups", "home", "ev", "ev"]);
    for (const n of l.nodes) {
      expect(dist(n.hubAnchor, l.hub)).toBeCloseTo(HUB_R, 5);
      expect(dist(n.anchor, n.center)).toBeCloseTo(NODE_R, 5);
    }
  });

  it("spreads several nodes on one side evenly and symmetrically about the hub", () => {
    const l = lay(["battery", "battery", "battery"]);
    const xs = l.nodes.map((n) => n.center.x);
    expect(xs[1]).toBeCloseTo(l.hub.x, 5);
    expect(xs[1] - xs[0]).toBeCloseTo(xs[2] - xs[1], 5);
    expect(l.nodes.every((n) => n.center.y === l.nodes[0].center.y)).toBe(true);
  });

  it("keeps every node and its label inside the drawing", () => {
    const l = lay(["solar", "grid", "generator", "battery", "ups", "home", "ev", "ev", "ev"]);
    for (const n of l.nodes) {
      expect(n.center.x - NODE_R).toBeGreaterThanOrEqual(0);
      expect(n.center.x + NODE_R).toBeLessThanOrEqual(VIEW_W);
      expect(n.center.y - NODE_R).toBeGreaterThanOrEqual(0);
      expect(n.center.y + NODE_R + 40).toBeLessThanOrEqual(l.height);
    }
  });

  it("never lets two circles overlap, however many nodes there are", () => {
    const l = lay(["solar", "grid", "generator", "battery", "battery", "battery", "battery", "battery", "ups", "home", "ev", "ev", "ev"]);
    for (let i = 0; i < l.nodes.length; i++) {
      for (let j = i + 1; j < l.nodes.length; j++) {
        expect(dist(l.nodes[i].center, l.nodes[j].center)).toBeGreaterThan(2 * NODE_R + 30);
      }
      expect(dist(l.nodes[i].center, l.hub)).toBeGreaterThan(NODE_R + HUB_R + 20);
    }
  });

  it("wraps a long bottom row onto a second row", () => {
    const l = lay(["battery", "battery", "battery", "battery", "battery"]);
    const ys = new Set(l.nodes.map((n) => n.center.y));
    expect(ys.size).toBe(2);
  });

  it("is shorter when nothing is above or below the hub", () => {
    expect(lay(["grid", "home"]).height).toBeLessThan(lay(["solar", "grid", "battery", "home"]).height);
  });

  it("orders the generator below the grid and chargers below the home", () => {
    const l = lay(["generator", "ev", "grid", "home"]);
    const y = (k: NodeKind) => l.nodes.find((n) => n.item === k)!.center.y;
    expect(y("grid")).toBeLessThan(y("generator"));
    expect(y("home")).toBeLessThan(y("ev"));
  });
});

describe("curvePath", () => {
  it("leaves along the travel axis", () => {
    expect(curvePath({ x: 0, y: 0 }, { x: 100, y: 40 }, false)).toBe("M 0 0 C 50 0, 50 40, 100 40");
    expect(curvePath({ x: 0, y: 0 }, { x: 40, y: 100 }, true)).toBe("M 0 0 C 0 50, 40 50, 40 100");
  });
});

describe("compactLayout", () => {
  const kinds: NodeKind[][] = [["solar", "grid", "battery", "home"], ["solar", "grid", "battery", "home", "ev"], ["grid", "home"], ["solar"], ["solar", "grid", "battery", "home", "generator", "ups", "ev"]];
  it("keeps every circle inside the drawing and clear of the others", () => {
    for (const ks of kinds) {
      const l = compactLayout(ks, (k) => k);
      expect(l.nodes).toHaveLength(ks.length);
      for (const n of l.nodes) {
        expect(n.center.x - COMPACT_NODE_R).toBeGreaterThanOrEqual(0);
        expect(n.center.x + COMPACT_NODE_R).toBeLessThanOrEqual(VIEW_W);
        expect(n.center.y + COMPACT_NODE_R).toBeLessThanOrEqual(l.height);
        expect(dist(n.center, l.hub)).toBeGreaterThan(COMPACT_NODE_R + COMPACT_HUB_R + 8);
      }
      for (let i = 0; i < l.nodes.length; i++) for (let j = i + 1; j < l.nodes.length; j++) expect(dist(l.nodes[i].center, l.nodes[j].center)).toBeGreaterThan(2 * COMPACT_NODE_R + 20);
    }
  });
  it("puts the hub in a row of three with solar on its left and the load on its right, the rest under it", () => {
    const l = compactLayout(["solar", "grid", "battery", "home"] as NodeKind[], (k) => k);
    const at = (k: NodeKind) => l.nodes.find((n) => n.item === k)!;
    expect(at("solar").center.y).toBe(l.hub.y);
    expect(at("home").center.y).toBe(l.hub.y);
    expect(at("solar").center.x).toBeLessThan(l.hub.x);
    expect(at("home").center.x).toBeGreaterThan(l.hub.x);
    expect(at("grid").center.y).toBeGreaterThan(l.hub.y);
    expect(at("battery").center.y).toBeGreaterThan(l.hub.y);
  });
});
