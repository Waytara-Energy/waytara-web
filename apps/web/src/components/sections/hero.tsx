"use client";

import * as React from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Pause, Play } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { CloudShader } from "@/components/ui/cloud-shader";
import { useHasMounted } from "@/hooks/use-has-mounted";

const VIDEO = "/videos/energy-banner.mp4";
// A still of the street scene: shown while the video loads, and kept for visitors who ask for less motion or for less data.
const POSTER = "/videos/energy-banner-poster.webp";
// Height of the fixed menu bar (the same clamp the bar itself uses); everything starts below it.
const NAV_HEIGHT = "clamp(3.5rem,4.5vw,4.25rem)";
// The sky behind the hero: the day sky (the text on it is white) and, in the dark theme, the same sky at dusk.
const SKY_DAY = { top: "#3876ba", bottom: "#8cbfe8", cloud: "#fbf8f2" };
const SKY_DUSK = { top: "#070d1f", bottom: "#1b2a4a", cloud: "#8d9bb8" };

// The pull-up: how much of the card shows at the start (a fifth of its height), how far the page scrolls (in screens) while it is pulled up and
// grown, and how much of that scroll the move itself uses (the rest is a rest, with the whole card in view, before the page moves on).
const PEEK = 0.2;
const TRAVEL_SCREENS = 0.8;
const MOVE_SHARE = 0.85;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

// Whether the visitor asked for less motion. The server-built page assumes not; a visitor who did gets the still layout as soon as the page is live.
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const readReducedMotion = () => window.matchMedia(REDUCED_MOTION).matches;
const serverReducedMotion = () => false;

/**
 * The top of the landing page, kept to the minimum: a headline, one line under it, two small buttons, and a large animation of what the product is.
 *
 * The page opens with only a fifth of the animation card showing at the foot of the screen, as wide as the text above it. Scrolling pins the scene,
 * pulls the card up and grows it to the largest size at which the whole card still fits the window, and the text above lifts away. The video is in the
 * card and scales with it, as one piece. If the visitor stops part-way, the page finishes the move by itself (forwards if they were scrolling down,
 * back to the start if up). The numbers all come from --p (0 to 1, how far along the move is) set from the scroll position, so scrolling never
 * re-renders the page.
 *
 * The video has no sound, so it may start on its own. It is paused while out of view, it does not start for visitors who asked for less motion or for
 * less data (they see the still and a play button), and everyone gets a pause button. For visitors who ask for less motion nothing is pinned or moved:
 * the card is simply shown at full size under the text.
 */
export function Hero() {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const outerRef = React.useRef<HTMLDivElement>(null);
  const sceneRef = React.useRef<HTMLDivElement>(null);
  const textRef = React.useRef<HTMLDivElement>(null);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const reduced = React.useSyncExternalStore(subscribeReducedMotion, readReducedMotion, serverReducedMotion);
  // The theme is not known until the page has loaded in the browser, so the server-built page always has the day sky.
  const { resolvedTheme } = useTheme();
  const mounted = useHasMounted();
  const sky = mounted && resolvedTheme === "dark" ? SKY_DUSK : SKY_DAY;
  // True once the visitor pressed pause, or never asked to play: scrolling back into view must not start it again then.
  const heldBack = React.useRef(false);

  // The pull-up: sizes, then --p from the scroll position, then the finishing move.
  React.useEffect(() => {
    const outer = outerRef.current;
    const scene = sceneRef.current;
    const text = textRef.current;
    const card = cardRef.current;
    if (reduced || !outer || !scene || !text || !card) return;

    // Where the card starts and ends, from the sizes on this screen.
    const measure = () => {
      const sceneH = scene.clientHeight;
      const cardW = card.offsetWidth;
      const cardH = card.offsetHeight;
      const styles = getComputedStyle(text);
      const contentW = text.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
      const navH = document.querySelector("header")?.getBoundingClientRect().height ?? 64;
      const s0 = Math.min(1, contentW / cardW); // the start width is the text's width
      const y0 = sceneH - PEEK * cardH * s0; // a fifth of the card shows
      const y1 = navH + Math.max(8, (sceneH - navH - cardH) / 2); // the whole card, centred in what is left below the bar
      scene.style.setProperty("--s0", s0.toFixed(4));
      scene.style.setProperty("--y0", `${Math.round(y0)}px`);
      scene.style.setProperty("--y1", `${Math.round(y1)}px`);
    };

    const progress = () => {
      const travel = outer.offsetHeight - scene.offsetHeight;
      const raw = travel > 0 ? clamp01(-outer.getBoundingClientRect().top / travel) : 0;
      return { raw, p: clamp01(raw / MOVE_SHARE), travel };
    };

    let frame = 0;
    const paint = () => {
      frame = 0;
      const { p } = progress();
      scene.style.setProperty("--p", p.toFixed(4));
      scene.dataset.past = p > 0.4 ? "1" : "0"; // the text has faded out from here on, so it must not catch clicks either
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };

    // The finishing move: when scrolling stops part-way, carry on to the end of the move (if going down) or back to the start (if going up).
    let lastY = window.scrollY;
    let direction = 1;
    let idle: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      const { raw, travel } = progress();
      if (raw <= 0 || raw >= MOVE_SHARE) return; // already at rest at either end
      const top = outer.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: direction > 0 ? top + MOVE_SHARE * travel : top, behavior: "smooth" });
    };
    const onScroll = () => {
      direction = window.scrollY >= lastY ? 1 : -1;
      lastY = window.scrollY;
      schedule();
      clearTimeout(idle);
      idle = setTimeout(finish, 140);
    };

    measure();
    paint();
    window.addEventListener("scroll", onScroll, { passive: true });
    const onResize = () => {
      measure();
      schedule();
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(frame);
      clearTimeout(idle);
    };
  }, [reduced]);

  // Play and pause.
  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // The video may have started before this page was ready to hear about it, so ask it rather than wait for an event.
    setPlaying(!video.paused);

    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || connection?.saveData) {
      heldBack.current = true;
      video.pause();
      return;
    }

    const watcher = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!heldBack.current) void video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      // A twentieth is enough: at the start only a fifth of the card shows, and it should already be playing.
      { threshold: 0.05 }
    );
    watcher.observe(video);
    return () => watcher.disconnect();
    // Again when the layout switches for reduced motion: that makes a new video element.
  }, [reduced]);

  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      heldBack.current = false;
      void video.play().catch(() => {});
    } else {
      heldBack.current = true;
      video.pause();
    }
  };

  const buttonBase =
    "inline-flex h-10 items-center rounded-full px-5 text-sm font-semibold transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#3876ba]";

  // The text block: the headline, the line and the buttons.
  const text = (
    <div ref={textRef} className="fluid-container">
      <Reveal direction="up" delay={100} duration={800} distance={24}>
        <h1 className="font-bold tracking-tight leading-[1.05] text-white text-balance text-[clamp(2rem,4.4vw,4.25rem)] drop-shadow-[0_2px_14px_rgba(0,20,60,0.35)]">
          <span className="block sm:whitespace-nowrap">Your property&rsquo;s energy,</span>
          <span className="block sm:whitespace-nowrap">built as one system.</span>
        </h1>
      </Reveal>

      <Reveal direction="up" delay={220} duration={800} distance={16} className="mt-5 max-w-xl">
        <p className="text-[clamp(1rem,1.3vw,1.2rem)] leading-relaxed text-white/90 drop-shadow-[0_1px_8px_rgba(0,20,60,0.35)]">
          Solar, battery storage and EV charging, designed, installed and managed together.
        </p>
      </Reveal>

      <Reveal direction="up" delay={340} duration={700} distance={12} className="mt-7 flex flex-wrap items-center gap-3">
        <Link href="/planner" className={`${buttonBase} bg-white text-slate-950 shadow-lg shadow-black/20 hover:bg-white/90`}>
          Plan my system
        </Link>
        <Link
          href="/contact"
          className={`${buttonBase} border border-white/30 bg-slate-950/40 text-white backdrop-blur-sm hover:bg-slate-950/55`}
        >
          Talk to us
        </Link>
      </Reveal>
    </div>
  );

  // The card: the animation and its pause button, one piece (it is the card that scales, the video is just inside it).
  const card = (
    <div
      ref={cardRef}
      className="relative aspect-video overflow-hidden rounded-[20px] bg-white shadow-2xl shadow-black/25 sm:rounded-[28px]"
      style={{
        // As wide as the page allows, but never so tall that the whole card cannot be in view at once (below the menu bar, with a little air).
        width: `min(calc(100% - 2rem), calc((max(100dvh, 620px) - ${NAV_HEIGHT} - 1.5rem) * 16 / 9))`,
        ...(reduced
          ? {}
          : {
              transformOrigin: "50% 0%",
              translate: "0 calc(var(--y0) + (var(--y1) - var(--y0)) * var(--p))",
              scale: "calc(var(--s0) + (1 - var(--s0)) * var(--p))",
              willChange: "transform",
            }),
      }}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        poster={POSTER}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-label="Animation: a property with solar panels, a battery, an inverter, an IoT gateway and an EV charger, connected to the cloud dashboard where the owner monitors and controls them."
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      >
        <source src={VIDEO} type="video/mp4" />
      </video>

      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause the animation" : "Play the animation"}
        className="absolute bottom-4 right-4 flex size-11 cursor-pointer items-center justify-center rounded-full bg-black/70 text-white ring-1 ring-white/20 backdrop-blur-sm transition hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:bottom-5 sm:right-5"
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </button>
    </div>
  );

  // The sky and its two soft edges: a shade under the transparent menu bar (so its white links read), and a foot that fades into the page colour.
  const background = (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <CloudShader
        className="absolute inset-0 h-full min-h-0"
        skyTopColor={sky.top}
        skyBottomColor={sky.bottom}
        cloudColor={sky.cloud}
        maxPixelRatio={1}
      />
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/35 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-theme-bg" />
    </div>
  );

  // Visitors who asked for less motion: no pinning and no movement, just the text and the card at full size under it.
  if (reduced) {
    return (
      <section className="relative overflow-hidden bg-theme-bg pb-10" style={{ paddingTop: `calc(${NAV_HEIGHT} + clamp(2.5rem, 9vh, 6.5rem))` }}>
        {background}
        <link rel="preload" as="image" href={POSTER} fetchPriority="high" />
        <div className="relative z-10">
          {text}
          <div className="mt-10 flex justify-center">{card}</div>
        </div>
      </section>
    );
  }

  return (
    // The outer box is taller than the screen; the scene sticks to the top of it while that extra height scrolls by.
    <div ref={outerRef} className="relative" style={{ height: `calc(max(100dvh, 620px) + ${TRAVEL_SCREENS * 100}dvh)` }}>
      <section
        ref={sceneRef}
        className="group sticky top-0 h-[100dvh] min-h-[620px] overflow-hidden bg-[#3876ba] [--p:0] [--s0:0.85] [--y0:62dvh] [--y1:5rem]"
      >
        {/* The still is what the page paints first, so it is asked for at once. */}
        <link rel="preload" as="image" href={POSTER} fetchPriority="high" />
        {background}

        {/* The text, lower than the menu bar by a good margin. As the card is pulled up it lifts away and fades. */}
        <div
          className="absolute inset-x-0 z-10 group-data-[past=1]:pointer-events-none"
          style={{
            top: `calc(${NAV_HEIGHT} + clamp(2.5rem, 9vh, 6.5rem))`,
            transform: "translateY(calc(var(--p) * -90px))",
            opacity: "calc(1 - var(--p) * 1.8)",
          }}
        >
          {text}
        </div>

        {/* The card, placed from the top of the scene by --y0 to --y1 and scaled from --s0 to 1 (see the effect above). */}
        <div className="absolute inset-x-0 top-0 z-20 flex justify-center pointer-events-none">
          <div className="pointer-events-auto contents">{card}</div>
        </div>
      </section>
    </div>
  );
}
