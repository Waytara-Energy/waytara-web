"use client";

import * as React from "react";
import { curveControls, type Point } from "./energy-flow-layout";
import type { IconShape } from "./flow-icon-shapes";

// The moving part of the energy flow, drawn on ONE canvas over the whole diagram (plain 2D drawing: no WebGL, light enough for a phone):
//  - each circle's ICON, made of small grains on a fine grid (a dot-matrix of the icon, nothing around it). The grains shimmer in place and a soft sheen
//    runs through them the way the energy goes; the icon's lines are thicker the more power moves. Pointing at a circle (or pressing it on a phone)
//    SCATTERS the grains about inside the ring, and when the pointer leaves they fly back into the icon. They also fly in when the drawing first appears;
//  - the DROPS of power on the connecting lines: a bright head with a tapering tail that runs along the line the way the energy goes (more of them, larger
//    and faster with more power), and a small ripple where each one arrives.
// The rings themselves are plain CSS (see the diagram). Nothing moves for visitors who asked for less motion, or while the unit is offline: then the
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
  /** The inverter's circle: on a wide drawing its icon sits a little higher, to leave room for the word under it. */
  hub?: boolean;
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

/** From this width (CSS px) the inverter's circle shows its word, so its icon moves up (the same line as the `@md` container query in the diagram). */
const WIDE_PX = 448;

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

interface Pulse {
  x: number;
  y: number;
  color: string;
  at: number;
}

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
    const pulses: Pulse[] = [];
    const dropPhase = new Map<string, number>();
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

    const iconCenter = (node: FlowCanvasNode): Point => ({ x: node.center.x, y: node.center.y - (node.hub && cssW >= WIDE_PX ? node.radius * 0.17 : 0) });

    const draw = (dt: number) => {
      const s = sceneRef.current;
      const scale = cssW / s.width;
      const still = reduced || s.frozen;
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
      ctx.clearRect(0, 0, s.width, s.height);
      // the pointer, in the drawing's units
      const px = pointer.x / scale;
      const py = pointer.y / scale;

      // ---- the drops on the lines
      if (!still) {
        for (const line of s.lines) {
          if (!line.active) {
            dropPhase.delete(line.id);
            continue;
          }
          const [c1, c2] = curveControls(line.from, line.to, line.vertical);
          const at = (t: number): Point => ({ x: bez(line.from.x, c1.x, c2.x, line.to.x, t), y: bez(line.from.y, c1.y, c2.y, line.to.y, t) });
          const period = 2.7 - 1.4 * line.level;
          const count = line.level < 0.34 ? 1 : line.level < 0.67 ? 2 : 3;
          const before = dropPhase.get(line.id) ?? Math.random();
          const phase = before + dt / period;
          dropPhase.set(line.id, phase % 1);
          const head = 2.1 + 1.5 * line.level;
          for (let k = 0; k < count; k++) {
            const t0 = (before + k / count) % 1;
            const t = (phase + k / count) % 1;
            // it has arrived: a ripple where the line meets the circle
            if (t < t0) pulses.push({ x: line.to.x, y: line.to.y, color: line.color, at: clock });
            const fade = smooth(0, 0.1, t) * (1 - smooth(0.9, 1, t));
            // the tail, thinning out behind the head
            const TAIL = 16;
            for (let j = TAIL; j >= 1; j--) {
              const tt = t - j * 0.013 * (1 + line.level);
              if (tt <= 0) continue;
              const p = at(tt);
              const f = 1 - j / (TAIL + 1);
              ctx.globalAlpha = fade * f * f * 0.55;
              ctx.fillStyle = line.color;
              ctx.beginPath();
              ctx.arc(p.x, p.y, head * (0.25 + 0.6 * f), 0, Math.PI * 2);
              ctx.fill();
            }
            const p = at(t);
            // the glow round the head
            const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, head * 4);
            glow.addColorStop(0, line.color);
            glow.addColorStop(1, "transparent");
            ctx.globalAlpha = fade * (s.dark ? 0.5 : 0.16);
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(p.x, p.y, head * 4, 0, Math.PI * 2);
            ctx.fill();
            // the head, with a light core
            ctx.globalAlpha = fade;
            ctx.fillStyle = line.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, head, 0, Math.PI * 2);
            ctx.fill();
            if (s.dark) {
              ctx.globalAlpha = fade * 0.9;
              ctx.fillStyle = "#fff";
              ctx.beginPath();
              ctx.arc(p.x, p.y, head * 0.45, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
        // the ripples
        for (let i = pulses.length - 1; i >= 0; i--) {
          const age = (clock - pulses[i].at) / 0.5;
          if (age >= 1) {
            pulses.splice(i, 1);
            continue;
          }
          ctx.globalAlpha = (1 - age) * (1 - age) * 0.6;
          ctx.strokeStyle = pulses[i].color;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(pulses[i].x, pulses[i].y, 2.5 + age * 9, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else {
        pulses.length = 0;
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
