"use client";

import * as React from "react";
import { curveControls, type Point } from "./energy-flow-layout";
import type { IconShape } from "./flow-icon-shapes";

// The moving part of the energy flow, drawn on ONE canvas over the whole diagram (plain 2D drawing: no WebGL, light enough for a phone):
//  - each circle's ICON, made of small grains on a fine grid (a dot-matrix of the icon, nothing around it). The grains shimmer in place and a soft sheen
//    runs through them the way the energy goes; the icon's lines are thicker the more power moves. Pointing at a circle (or pressing it on a phone)
//    SCATTERS the grains about inside the ring, and when the pointer leaves they fly back into the icon. They also fly in when the drawing first appears;
//  - the BEAMS on the connecting lines, the way a phone shows that it is charging: a line of light with a glow round it, brighter towards where the energy
//    is going, with surges of light running along it, small sparks streaming beside it and drawing in to it as they arrive, and a flare where it pours
//    into the circle. All of it is wider, brighter and faster with more power.
// The rings themselves are the diagram's (a ball of light each). Nothing moves for visitors who asked for less motion, or while the unit is offline: then the
// icons are drawn once, still.

export interface FlowCanvasNode {
  id: string;
  center: Point;
  /** The circle's radius, in the drawing's own units. */
  radius: number;
  color: string;
  icon: IconShape;
  /** The icon's line thickness, in its own 24-unit drawing. */
  stroke: number;
  /** The icon's size as a share of the circle's diameter. */
  iconScale: number;
  /** Which way the sheen runs: towards this point (energy leaving the circle that way) or away from it (energy arriving from there). */
  port: Point | null;
  dir: "in" | "out" | "none";
  /** 0 to 1: how hard it works. */
  level: number;
}

export interface FlowCanvasLine {
  id: string;
  from: Point;
  to: Point;
  vertical: boolean;
  color: string;
  active: boolean;
  level: number;
}

export interface FlowCanvasScene {
  width: number;
  height: number;
  nodes: FlowCanvasNode[];
  lines: FlowCanvasLine[];
  frozen: boolean;
  dark: boolean;
}

// ---- the icons as grids of grains -------------------------------------------------------------------------------------------------------------------

const rasterCache = new WeakMap<IconShape, Map<string, Float32Array>>();

/** The icon as lit cells of an n x n grid: for each, x and y (-0.5 to 0.5, y down) and how much of the cell the line covers (0 to 1). */
function rasterIcon(shape: IconShape, stroke: number, n: number): Float32Array {
  const key = `${stroke}/${n}`;
  let byKey = rasterCache.get(shape);
  if (!byKey) rasterCache.set(shape, (byKey = new Map()));
  const cached = byKey.get(key);
  if (cached) return cached;

  // drawn three times larger than the grid and averaged down, so a cell's value is how much of it the line really covers
  const S = 3;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = n * S;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const found: number[] = [];
  if (ctx) {
    ctx.scale((n * S) / 24, (n * S) / 24);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = stroke;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const num = (a: Record<string, string>, k: string) => Number(a[k] ?? 0);
    for (const [tag, a] of shape) {
      ctx.beginPath();
      if (tag === "path") {
        ctx.stroke(new Path2D(a.d));
        continue;
      }
      if (tag === "circle") ctx.arc(num(a, "cx"), num(a, "cy"), num(a, "r"), 0, Math.PI * 2);
      else if (tag === "ellipse") ctx.ellipse(num(a, "cx"), num(a, "cy"), num(a, "rx"), num(a, "ry"), 0, 0, Math.PI * 2);
      else if (tag === "line") {
        ctx.moveTo(num(a, "x1"), num(a, "y1"));
        ctx.lineTo(num(a, "x2"), num(a, "y2"));
      } else if (tag === "rect") {
        const r = Number(a.rx ?? a.ry ?? 0);
        if (r > 0 && ctx.roundRect) ctx.roundRect(num(a, "x"), num(a, "y"), num(a, "width"), num(a, "height"), r);
        else ctx.rect(num(a, "x"), num(a, "y"), num(a, "width"), num(a, "height"));
      } else if (tag === "polyline" || tag === "polygon") {
        const pts = (a.points ?? "").trim().split(/[\s,]+/).map(Number);
        for (let i = 0; i + 1 < pts.length; i += 2) {
          if (i === 0) ctx.moveTo(pts[0], pts[1]);
          else ctx.lineTo(pts[i], pts[i + 1]);
        }
        if (tag === "polygon") ctx.closePath();
      }
      ctx.stroke();
    }
    const px = ctx.getImageData(0, 0, n * S, n * S).data;
    for (let cy = 0; cy < n; cy++) {
      for (let cx = 0; cx < n; cx++) {
        let sum = 0;
        for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) sum += px[((cy * S + dy) * n * S + cx * S + dx) * 4 + 3];
        const cover = sum / (S * S * 255);
        if (cover > 0.3) found.push((cx + 0.5) / n - 0.5, (cy + 0.5) / n - 0.5, Math.min(1, cover * 1.15));
      }
    }
  }
  const out = Float32Array.from(found);
  byKey.set(key, out);
  return out;
}

/** One circle's grains. Positions are in the drawing's units, measured from the icon's centre. */
interface Grains {
  key: string;
  count: number;
  pitch: number;
  tx: Float32Array;
  ty: Float32Array;
  cover: Float32Array;
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  seed: Float32Array;
  /** When the grains were last let go (seconds on the drawing's clock): each returns to the icon a moment later, one after another. */
  releasedAt: number;
  scattered: boolean;
}

/** One spark beside a beam. */
interface Spark {
  /** How far along the line it is (0 to 1). */
  t: number;
  speed: number;
  /** Which side of the line, and how far out (0 to 1). */
  side: number;
  off: number;
  size: number;
  seed: number;
}
interface Beam {
  phase: number;
  sparks: Spark[];
}
const newSpark = (anywhere: boolean): Spark => ({
  t: anywhere ? Math.random() : Math.random() * 0.06,
  speed: 0.35 + Math.random() * 0.75,
  side: Math.random() < 0.5 ? -1 : 1,
  off: Math.pow(Math.random(), 1.6),
  size: 0.7 + Math.random() * 1.1,
  seed: Math.random(),
});

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const bez = (a: number, b: number, c: number, d: number, t: number) => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};

export function EnergyFlowCanvas({ scene, className }: { scene: FlowCanvasScene; className?: string }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const sceneRef = React.useRef(scene);
  const wakeRef = React.useRef<(() => void) | null>(null);
  React.useEffect(() => {
    sceneRef.current = scene;
    wakeRef.current?.();
  });

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !host || !ctx) return undefined;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const grains = new Map<string, Grains>();
    const beams = new Map<string, Beam>();
    const pointer = { x: 0, y: 0, inside: false, down: false };
    let cssW = 1;
    let cssH = 1;
    let dpr = 1;
    let raf = 0;
    let last = 0;
    let clock = 0;
    let visible = true;
    let alive = true;

    const resize = () => {
      cssW = Math.max(1, host.clientWidth);
      cssH = Math.max(1, host.clientHeight);
      dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      wake();
    };

    /** The grains of one circle, rebuilt when its icon, its line thickness or its size on screen changes; the grains keep where they are and re-form. */
    const grainsFor = (node: FlowCanvasNode, scale: number): Grains => {
      const iconUnits = node.radius * 2 * node.iconScale;
      // about one grain every 1.15 CSS pixels, between 18 and 44 across the icon
      const n = clamp(Math.round((iconUnits * scale) / 1.15), 18, 44);
      const key = `${node.stroke}/${n}/${iconUnits.toFixed(1)}`;
      const old = grains.get(node.id);
      if (old && old.key === key && sameShape.get(node.id) === node.icon) return old;
      sameShape.set(node.id, node.icon);
      const cells = rasterIcon(node.icon, node.stroke, n);
      const count = cells.length / 3;
      const g: Grains = {
        key,
        count,
        pitch: iconUnits / n,
        tx: new Float32Array(count),
        ty: new Float32Array(count),
        cover: new Float32Array(count),
        x: new Float32Array(count),
        y: new Float32Array(count),
        vx: new Float32Array(count),
        vy: new Float32Array(count),
        seed: new Float32Array(count),
        releasedAt: old ? old.releasedAt : clock,
        scattered: old ? old.scattered : false,
      };
      for (let i = 0; i < count; i++) {
        g.tx[i] = cells[i * 3] * iconUnits;
        g.ty[i] = cells[i * 3 + 1] * iconUnits;
        g.cover[i] = cells[i * 3 + 2];
        g.seed[i] = Math.random();
        if (old && old.count) {
          // a grain of the old icon becomes a grain of the new one, and moves over
          const j = Math.floor(Math.random() * old.count);
          g.x[i] = old.x[j];
          g.y[i] = old.y[j];
        } else if (reduced) {
          g.x[i] = g.tx[i];
          g.y[i] = g.ty[i];
        } else {
          // first appearance: scattered about the circle, then they gather
          const a = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * node.radius * 0.82;
          g.x[i] = Math.cos(a) * r;
          g.y[i] = Math.sin(a) * r;
        }
      }
      grains.set(node.id, g);
      return g;
    };
    const sameShape = new Map<string, IconShape>();

    const iconCenter = (node: FlowCanvasNode): Point => node.center;

    const draw = (dt: number) => {
      const s = sceneRef.current;
      const scale = cssW / s.width;
      const still = reduced || s.frozen;
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
      ctx.clearRect(0, 0, s.width, s.height);
      // the pointer, in the drawing's units
      const px = pointer.x / scale;
      const py = pointer.y / scale;

      // ---- the beams on the lines
      if (!still) {
        ctx.lineCap = "round";
        for (const line of s.lines) {
          if (!line.active) {
            beams.delete(line.id);
            continue;
          }
          const { from, to } = line;
          const [c1, c2] = curveControls(from, to, line.vertical);
          const at = (t: number): Point => ({ x: bez(from.x, c1.x, c2.x, to.x, t), y: bez(from.y, c1.y, c2.y, to.y, t) });
          // the direction across the line at t (to set the sparks beside it)
          const across = (t: number): Point => {
            const u = 1 - t;
            const dx = 3 * u * u * (c1.x - from.x) + 6 * u * t * (c2.x - c1.x) + 3 * t * t * (to.x - c2.x);
            const dy = 3 * u * u * (c1.y - from.y) + 6 * u * t * (c2.y - c1.y) + 3 * t * t * (to.y - c2.y);
            const d = Math.hypot(dx, dy) || 1;
            return { x: -dy / d, y: dx / d };
          };
          const L = line.level;
          let beam = beams.get(line.id);
          if (!beam) beams.set(line.id, (beam = { phase: Math.random(), sparks: [] }));
          const want = 9 + Math.round(20 * L);
          while (beam.sparks.length < want) beam.sparks.push(newSpark(true));
          beam.sparks.length = want;
          beam.phase = (beam.phase + dt * (0.42 + 0.7 * L)) % 1;

          const path = new Path2D();
          path.moveTo(from.x, from.y);
          path.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, to.x, to.y);
          const w = 1 + 1.1 * L;
          const breathe = 0.86 + 0.14 * Math.sin(clock * 3.1 + beam.phase * 6.283);
          // light adds up on the dark theme (so the middle of the beam burns white); on the light theme it is laid on as colour
          ctx.globalCompositeOperation = s.dark ? "lighter" : "source-over";
          const along = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
          along.addColorStop(0, `${line.color}66`);
          along.addColorStop(1, line.color);
          ctx.strokeStyle = along;
          // the glow round the beam, then the beam
          const halo: [number, number][] = s.dark
            ? [
                [12, 0.05],
                [6.5, 0.1],
                [3.2, 0.24],
              ]
            : [
                [10, 0.045],
                [5.5, 0.08],
                [2.8, 0.18],
              ];
          for (const [width, alpha] of halo) {
            ctx.lineWidth = width * w;
            ctx.globalAlpha = alpha * breathe;
            ctx.stroke(path);
          }
          ctx.lineWidth = 1.15 * w;
          ctx.globalAlpha = (s.dark ? 0.9 : 0.7) * breathe;
          ctx.stroke(path);

          // the surges: stretches of brighter light that run along the beam, each fading out behind its head
          const surges = 2 + Math.round(2 * L);
          const SEG = 9;
          for (let k = 0; k < surges; k++) {
            const head = (beam.phase + k / surges) % 1;
            const edge = smooth(0, 0.12, head) * (1 - smooth(0.92, 1, head));
            for (let j = 0; j < SEG; j++) {
              const t1 = head - 0.22 * (1 - j / SEG);
              const t2 = head - 0.22 * (1 - (j + 1) / SEG);
              if (t2 <= 0) continue;
              const a = at(Math.max(0, t1));
              const b = at(t2);
              const f = (j + 1) / SEG;
              ctx.strokeStyle = line.color;
              ctx.globalAlpha = edge * f * f * (s.dark ? 0.7 : 0.95);
              ctx.lineWidth = w * (1.3 + 1.5 * f);
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
              if (s.dark) {
                ctx.strokeStyle = "#ffffff";
                ctx.globalAlpha = edge * f * f * 0.9;
                ctx.lineWidth = w * (0.5 + 0.7 * f);
                ctx.stroke();
              }
            }
          }

          // the sparks: small grains that stream beside the beam and draw in to it as they arrive
          for (const sp of beam.sparks) {
            sp.t += dt * sp.speed * (0.6 + 0.9 * L);
            if (sp.t >= 1) Object.assign(sp, newSpark(false));
            const p = at(sp.t);
            const n = across(sp.t);
            const out = (1 + 7 * Math.pow(1 - sp.t, 1.4)) * sp.off * sp.side + Math.sin(clock * (2 + sp.seed * 4) + sp.seed * 30) * 0.8;
            const fade = smooth(0, 0.15, sp.t) * (1 - smooth(0.88, 1, sp.t));
            const twinkle = 0.6 + 0.4 * Math.sin(clock * (5 + sp.seed * 9) + sp.seed * 70);
            const size = sp.size * (0.8 + 0.5 * L);
            ctx.globalAlpha = fade * twinkle * (s.dark ? 0.95 : 0.8);
            ctx.fillStyle = s.dark && sp.seed < 0.45 ? "#ffffff" : line.color;
            ctx.fillRect(p.x + n.x * out - size / 2, p.y + n.y * out - size / 2, size, size);
          }

          // the flare where the beam pours into the circle
          const r = (7 + 7 * L) * breathe;
          const flare = ctx.createRadialGradient(to.x, to.y, 0, to.x, to.y, r);
          flare.addColorStop(0, s.dark ? "#ffffff" : line.color);
          flare.addColorStop(0.22, line.color);
          flare.addColorStop(1, `${line.color}00`);
          ctx.globalAlpha = (s.dark ? 0.6 : 0.32) * breathe;
          ctx.fillStyle = flare;
          ctx.beginPath();
          ctx.arc(to.x, to.y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";
      } else {
        beams.clear();
      }

      // ---- the icons
      let settling = false;
      const seen = new Set<string>();
      for (const node of s.nodes) {
        seen.add(node.id);
        const g = grainsFor(node, scale);
        const c = iconCenter(node);
        // pointing at the circle (or pressing it) scatters its grains; leaving lets them go back
        const hovered = !still && pointer.inside && Math.hypot(px - node.center.x, py - node.center.y) < node.radius * 1.05;
        if (hovered && !g.scattered) {
          // the icon bursts: every grain is thrown its own way, a little more away from the pointer than towards it
          for (let i = 0; i < g.count; i++) {
            const a = Math.random() * Math.PI * 2;
            const ax = c.x + g.x[i] - px;
            const ay = c.y + g.y[i] - py;
            const d = Math.hypot(ax, ay) || 1;
            const push = node.radius * (0.8 + 2.4 * Math.random());
            g.vx[i] += Math.cos(a) * push + (ax / d) * push * 0.35;
            g.vy[i] += Math.sin(a) * push + (ay / d) * push * 0.35;
          }
        }
        if (!hovered && g.scattered) g.releasedAt = clock;
        g.scattered = hovered;

        const keepIn = node.radius * 0.84;
        const offX = c.x - node.center.x;
        const offY = c.y - node.center.y;
        // the sheen: a band of light that runs through the icon towards the line (energy leaving) or in from it (energy arriving)
        let sx = 0;
        let sy = -1;
        if (node.port) {
          const d = Math.hypot(node.port.x - node.center.x, node.port.y - node.center.y) || 1;
          sx = ((node.port.x - node.center.x) / d) * (node.dir === "in" ? 1 : -1);
          sy = ((node.port.y - node.center.y) / d) * (node.dir === "in" ? 1 : -1);
        }
        const half = node.radius * node.iconScale;
        const sheenAt = node.dir === "none" || still ? 9 : ((clock * (0.35 + 0.5 * node.level)) % 1) * 3.2 - 1.6;

        ctx.fillStyle = node.color;
        const base = g.pitch * 0.86;
        for (let i = 0; i < g.count; i++) {
          if (!still) {
            if (g.scattered) {
              // adrift inside the ring: a slow swirl, kept in by the ring
              const w = g.seed[i] * 6.283;
              g.vx[i] += Math.cos(clock * 0.9 + w + g.y[i] * 0.08) * node.radius * 0.9 * dt;
              g.vy[i] += Math.sin(clock * 0.7 + w * 1.7 + g.x[i] * 0.08) * node.radius * 0.9 * dt;
              const drag = Math.exp(-dt * 1.5);
              g.vx[i] *= drag;
              g.vy[i] *= drag;
            } else {
              // back to its place in the icon (each grain a moment after the one before), where it trembles a little
              const waited = clock - g.releasedAt - g.seed[i] * 0.45;
              const pull = waited <= 0 ? 0 : Math.min(1, waited * 4);
              const jx = Math.sin(clock * (1.3 + g.seed[i] * 1.9) + g.seed[i] * 40) * g.pitch * 0.16;
              const jy = Math.cos(clock * (1.1 + g.seed[i] * 2.3) + g.seed[i] * 23) * g.pitch * 0.16;
              const k = 70 * pull;
              g.vx[i] += (k * (g.tx[i] + jx - g.x[i]) - (pull ? 13 : 2.2) * g.vx[i]) * dt;
              g.vy[i] += (k * (g.ty[i] + jy - g.y[i]) - (pull ? 13 : 2.2) * g.vy[i]) * dt;
              if (Math.abs(g.tx[i] - g.x[i]) + Math.abs(g.ty[i] - g.y[i]) > g.pitch * 0.6) settling = true;
            }
            g.x[i] += g.vx[i] * dt;
            g.y[i] += g.vy[i] * dt;
            // the ring holds them in (measured from the circle's own centre)
            const rx = g.x[i] + offX;
            const ry = g.y[i] + offY;
            const d = Math.hypot(rx, ry);
            if (d > keepIn) {
              const nx = rx / d;
              const ny = ry / d;
              g.x[i] -= nx * (d - keepIn);
              g.y[i] -= ny * (d - keepIn);
              const out = g.vx[i] * nx + g.vy[i] * ny;
              if (out > 0) {
                g.vx[i] -= nx * out * 1.9;
                g.vy[i] -= ny * out * 1.9;
              }
            }
          } else {
            g.x[i] = g.tx[i];
            g.y[i] = g.ty[i];
          }
          const along = (g.tx[i] * sx + g.ty[i] * sy) / half;
          const lit = g.scattered ? 0 : Math.exp(-((along - sheenAt) * (along - sheenAt)) / 0.16);
          const twinkle = still ? 1 : 0.82 + 0.18 * Math.sin(clock * (2 + g.seed[i] * 5) + g.seed[i] * 50);
          const size = base * (0.7 + 0.3 * g.cover[i]) * (1 + 0.28 * lit);
          ctx.globalAlpha = clamp((0.62 + 0.38 * g.cover[i]) * twinkle * (node.dir === "none" ? 0.85 : 1) + 0.25 * lit, 0, 1);
          ctx.fillRect(c.x + g.x[i] - size / 2, c.y + g.y[i] - size / 2, size, size);
        }
        if (g.scattered) settling = true;
      }
      for (const id of grains.keys()) if (!seen.has(id)) grains.delete(id);
      ctx.globalAlpha = 1;
      return settling;
    };

    const frame = (now: number) => {
      raf = 0;
      if (!alive || !visible || document.hidden) return;
      const dt = last ? clamp((now - last) / 1000, 0.001, 0.05) : 1 / 60;
      last = now;
      clock += dt;
      const settling = draw(dt);
      const s = sceneRef.current;
      // still pictures (less motion asked for, or the unit offline) are drawn once; otherwise the drawing keeps going
      if ((!reduced && !s.frozen) || settling) raf = requestAnimationFrame(frame);
    };
    const wake = () => {
      if (!raf && alive && visible && !document.hidden) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    };
    wakeRef.current = wake;

    const locate = (e: PointerEvent) => {
      const box = host.getBoundingClientRect();
      pointer.x = e.clientX - box.left;
      pointer.y = e.clientY - box.top;
    };
    const onMove = (e: PointerEvent) => {
      locate(e);
      // a finger only counts while it is down
      pointer.inside = e.pointerType === "mouse" || pointer.down;
    };
    const onDown = (e: PointerEvent) => {
      locate(e);
      pointer.down = true;
      pointer.inside = true;
    };
    const onUp = (e: PointerEvent) => {
      pointer.down = false;
      if (e.pointerType !== "mouse") pointer.inside = false;
    };
    const onLeave = () => {
      pointer.inside = false;
      pointer.down = false;
    };
    host.addEventListener("pointermove", onMove, { passive: true });
    host.addEventListener("pointerdown", onDown, { passive: true });
    host.addEventListener("pointerup", onUp, { passive: true });
    host.addEventListener("pointercancel", onLeave, { passive: true });
    host.addEventListener("pointerleave", onLeave, { passive: true });
    document.addEventListener("visibilitychange", wake);

    const sizes = new ResizeObserver(resize);
    sizes.observe(host);
    // only while it is on screen (the Overview keeps one drawing per device side by side)
    const watcher = new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting);
      wake();
    });
    watcher.observe(host);
    resize();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      wakeRef.current = null;
      sizes.disconnect();
      watcher.disconnect();
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointerup", onUp);
      host.removeEventListener("pointercancel", onLeave);
      host.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", wake);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className={className} />;
}
