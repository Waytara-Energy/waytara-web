"use client";

import * as React from "react";
import CrystalizedBall from "@/components/ui/crystalized-ball";
import { cn } from "@/lib/utils";
import { canDrawBalls } from "./energy-flow-diagram";

const subscribeNever = () => () => undefined;

/**
 * The dust of a Crystalized Ball (React Bits, ui/crystalized-ball.tsx: no rim, no strands, only the glittering particles) laid inside a bar, so that what
 * fills it looks like power flowing. The ball is a circle, so a big one (as wide as the bar, square, with the bar showing only its middle band) is turned a
 * quarter so that its particles, which rise, run along the bar from left to right.
 *
 * Put it inside the bar's filled part (or a clipped copy of the bar): it paints over the width of the nearest ancestor with `container-type: inline-size`
 * (`100cqw`, so it keeps its size while the filled part grows) and only what that ancestor does not clip shows. It lets its WebGL picture go whenever it
 * is off screen (a browser allows about sixteen), and is a still, quiet bar when the browser cannot draw it or less motion is asked for.
 */
export function FlowFill({ color = "#34d399", speed = 1, density = 14000, className }: { color?: string; speed?: number; density?: number; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const watcher = new IntersectionObserver((entries) => setOnScreen(entries.some((e) => e.isIntersecting)), { rootMargin: "60px" });
    watcher.observe(el);
    return () => watcher.disconnect();
  }, []);
  // (Known only in the browser: assumed to work on the server so the first paint matches.)
  const ok = React.useSyncExternalStore(subscribeNever, canDrawBalls, () => true);
  const reduced = React.useSyncExternalStore(
    (cb) => {
      const q = window.matchMedia("(prefers-reduced-motion: reduce)");
      q.addEventListener("change", cb);
      return () => q.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
  return (
    <div ref={ref} aria-hidden="true" className={cn("pointer-events-none absolute inset-y-0 left-0 w-[100cqw]", className)}>
      {ok && onScreen && (
        // a square as wide as the bar, turned a quarter, centred on the bar's height
        <div className="absolute top-1/2 left-0 aspect-square w-full -translate-y-1/2 rotate-90">
          <CrystalizedBall
            preset="plasma"
            color={color}
            theme="dark"
            size={1.5}
            // only the dust: no strands, crackle, flares, sparks, haze or glow
            strands={0}
            crackle={0}
            flares={0}
            sparks={0}
            haze={0}
            glow={0}
            particleCount={density}
            fill={1}
            motion="rise"
            particleShape="round"
            depth={0.6}
            sway={0.2}
            twinkle={0.7}
            dustSpeed={speed}
            speed={speed}
            interactive={false}
            intro={false}
            paused={reduced}
          />
        </div>
      )}
    </div>
  );
}
