import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { C, SHADOW_SM, TEXT_GRAD, TOTAL } from "./theme";

export const clampBoth = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const outExpo = Easing.bezier(0.16, 1, 0.3, 1);
export const inOut = Easing.bezier(0.65, 0, 0.35, 1);

/** Progress 0..1 of a move that starts at `start` and takes `dur` frames. */
export const p = (frame: number, start: number, dur: number, easing: (n: number) => number = outExpo) =>
  interpolate(frame, [start, start + dur], [0, 1], { ...clampBoth, easing });
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const gradText: React.CSSProperties = {
  backgroundImage: TEXT_GRAD,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  WebkitTextFillColor: "transparent",
  color: "transparent",
};

/** The backdrop of the whole film: the page colour with three soft glows that drift once round over the film, so the last frame meets the first. */
export const Background: React.FC = () => {
  const f = useCurrentFrame();
  const a = (f / TOTAL) * Math.PI * 2;
  const blob = (x: number, y: number, size: number, color: string) => (
    <div
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color} 0%, rgba(255,255,255,0) 68%)`,
      }}
    />
  );
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {blob(380 + Math.sin(a) * 240, 1000 + Math.cos(a * 2) * 90, 1400, "rgba(52,211,153,0.30)")}
      {blob(1580 + Math.cos(a) * 200, 120 + Math.sin(a * 2) * 100, 1200, "rgba(132,204,22,0.17)")}
      {blob(1540 + Math.sin(a * 2) * 160, 1040 + Math.cos(a) * 80, 1000, "rgba(56,189,248,0.15)")}
    </AbsoluteFill>
  );
};

/** A scene: everything in it leaves together (a short fade, a slight push in and a blur) over its last frames. */
export const Scene: React.FC<{ dur: number; exit?: number; children: React.ReactNode }> = ({ dur, exit = 14, children }) => {
  const f = useCurrentFrame();
  const t = interpolate(f, [dur - exit, dur], [0, 1], { ...clampBoth, easing: Easing.in(Easing.cubic) });
  return (
    <AbsoluteFill style={{ opacity: 1 - t, transform: `scale(${1 + 0.035 * t})`, filter: t > 0 ? `blur(${t * 12}px)` : undefined }}>{children}</AbsoluteFill>
  );
};

/** Anything that arrives: it fades in, moves into place and sharpens. */
export const Enter: React.FC<{
  at: number;
  dur?: number;
  x?: number;
  y?: number;
  scale?: number;
  blur?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ at, dur = 18, x = 0, y = 26, scale = 1, blur = 10, style, children }) => {
  const f = useCurrentFrame();
  const t = p(f, at, dur);
  return (
    <div
      style={{
        opacity: t,
        transform: `translate(${(1 - t) * x}px, ${(1 - t) * y}px) scale(${lerp(scale, 1, t)})`,
        filter: t < 1 ? `blur(${(1 - t) * blur}px)` : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** A line of text that arrives one word at a time. Words listed in `accent` (by position) wear the green gradient. */
export const Words: React.FC<{
  text: string;
  at?: number;
  stagger?: number;
  size: number;
  weight?: number;
  color?: string;
  accent?: number[];
  style?: React.CSSProperties;
}> = ({ text, at = 0, stagger = 4, size, weight = 600, color = C.ink, accent = [], style }) => {
  const f = useCurrentFrame();
  const words = text.split(" ");
  return (
    <div style={{ fontSize: size, fontWeight: weight, color, letterSpacing: size > 60 ? -0.03 * size : -0.015 * size, lineHeight: 1.15, whiteSpace: "nowrap", ...style }}>
      {words.map((word, i) => {
        const t = p(f, at + i * stagger, 16);
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              marginRight: i < words.length - 1 ? "0.26em" : 0,
              paddingBottom: "0.08em",
              opacity: t,
              transform: `translateY(${(1 - t) * size * 0.28}px)`,
              filter: t < 1 ? `blur(${(1 - t) * 14}px)` : undefined,
              ...(accent.includes(i) ? gradText : null),
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

/**
 * The opening of a chapter: the word fills the screen, then settles in the top left corner as the chapter's name, with four small bars under it (which of
 * the four this is) and the chapter's one line on the right.
 */
export const Chapter: React.FC<{ word: string; index: number; caption: string; accent?: number[] }> = ({ word, index, caption, accent }) => {
  const f = useCurrentFrame();
  const arrive = p(f, 0, 16);
  const dock = p(f, 26, 24, inOut);
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: lerp(960, 120, dock),
          top: lerp(540, 112, dock),
          transform: `translate(${lerp(-50, 0, dock)}%, -50%) scale(${lerp(1, 0.3, dock) * lerp(0.9, 1, arrive)})`,
          transformOrigin: `${lerp(50, 0, dock)}% 50%`,
          opacity: arrive,
          filter: arrive < 1 ? `blur(${(1 - arrive) * 20}px)` : undefined,
          fontSize: 230,
          fontWeight: 700,
          letterSpacing: -7,
          lineHeight: 1.1,
          paddingBottom: 14,
          whiteSpace: "nowrap",
          ...gradText,
        }}
      >
        {word}.
      </div>
      <div style={{ position: "absolute", left: 122, top: 164, display: "flex", gap: 8, opacity: dock }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ width: i === index ? 56 : 28, height: 6, borderRadius: 3, background: i === index ? C.green : "#CBD5E1" }} />
        ))}
      </div>
      <div style={{ position: "absolute", right: 120, top: 112, transform: "translateY(-50%)" }}>
        <Words text={caption} at={44} stagger={3} size={42} weight={500} accent={accent} />
      </div>
    </>
  );
};

/** A white card. */
export const Card: React.FC<{ style?: React.CSSProperties; children?: React.ReactNode }> = ({ style, children }) => (
  <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 24, boxShadow: SHADOW_SM, ...style }}>{children}</div>
);

/** A small rounded label, with a dot that can breathe. */
export const Pill: React.FC<{ color: string; children: React.ReactNode; pulse?: boolean; size?: number }> = ({ color, children, pulse, size = 18 }) => {
  const f = useCurrentFrame();
  const beat = pulse ? 0.55 + 0.45 * Math.abs(Math.sin(f / 9)) : 1;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: size * 0.5,
        padding: `${size * 0.36}px ${size * 0.8}px`,
        borderRadius: 999,
        background: `${color}1A`,
        color,
        fontSize: size,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: size * 0.5, height: size * 0.5, borderRadius: "50%", background: color, opacity: beat }} />
      {children}
    </div>
  );
};

/** The pointer: it travels between the given points and presses at `click`, with a ring spreading from the tip. */
export const Cursor: React.FC<{ from: [number, number]; to: [number, number]; start: number; arrive: number; click: number; leave?: number }> = ({
  from,
  to,
  start,
  arrive,
  click,
  leave,
}) => {
  const f = useCurrentFrame();
  const t = p(f, start, arrive - start, inOut);
  const out = leave === undefined ? 0 : p(f, leave, 20, inOut);
  const x = lerp(from[0], to[0], t) + out * 220;
  const y = lerp(from[1], to[1], t) + out * 160;
  const press = interpolate(f, [click - 3, click, click + 5], [1, 0.82, 1], clampBoth);
  const ring = p(f, click, 18);
  const show = p(f, start, 8) * (1 - out);
  return (
    <>
      {f >= click && ring < 1 && (
        <div
          style={{
            position: "absolute",
            left: x - 50,
            top: y - 50,
            width: 100,
            height: 100,
            borderRadius: "50%",
            border: `4px solid ${C.green}`,
            opacity: 1 - ring,
            transform: `scale(${0.2 + ring * 1.1})`,
          }}
        />
      )}
      <svg width={54} height={54} viewBox="0 0 24 24" style={{ position: "absolute", left: x - 8, top: y - 4, opacity: show, transform: `scale(${press})`, transformOrigin: "20% 10%", filter: "drop-shadow(0 6px 8px rgba(15,23,42,0.3))" }}>
        <path d="M4 2 L4 19.5 L8.8 15.4 L12 22.4 L15 21 L11.9 14.2 L18.6 14.2 Z" fill={C.ink} stroke="#fff" strokeWidth={1.4} strokeLinejoin="round" />
      </svg>
    </>
  );
};

/** A number that is shown with a fixed number of decimals and digits of equal width (so it does not jitter while it counts). */
export const Num: React.FC<{ value: number; digits?: number; style?: React.CSSProperties }> = ({ value, digits = 1, style }) => (
  <span style={{ fontVariantNumeric: "tabular-nums", ...style }}>{value.toFixed(digits)}</span>
);
