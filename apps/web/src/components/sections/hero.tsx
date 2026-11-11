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
// Height of the fixed menu bar (the same clamp the bar itself uses); the headline starts below it.
const NAV_HEIGHT = "clamp(3.5rem,4.5vw,4.25rem)";
// How far the page scrolls (as a share of the screen's height) before the video card has finished growing.
const GROW_OVER = 0.55;
// The sky behind the hero: the day sky (the text on it is white) and, in the dark theme, the same sky at dusk.
const SKY_DAY = { top: "#3876ba", bottom: "#8cbfe8", cloud: "#fbf8f2" };
const SKY_DUSK = { top: "#070d1f", bottom: "#1b2a4a", cloud: "#8d9bb8" };

/**
 * The top of the landing page, kept to the minimum: a headline, one line under it, two small buttons, and a large animation of what the product is.
 *
 * The animation card starts a little smaller, inset and with rounder corners, and grows to the full width of the page as the visitor scrolls, while the
 * picture inside it settles from slightly zoomed to its true size. It is driven by --p (0 to 1, how far along the growth is), set from the scroll
 * position and read by the styles below, so scrolling never re-renders the page.
 *
 * The video has no sound, so it may start on its own. It is paused while out of view, it does not start for visitors who asked for less motion or for less
 * data (they see the still and a play button, and the card is full size from the start), and everyone gets a pause button.
 */
export function Hero() {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = React.useState(false);
  // The theme is not known until the page has loaded in the browser, so the server-built page always has the day sky.
  const { resolvedTheme } = useTheme();
  const mounted = useHasMounted();
  const sky = mounted && resolvedTheme === "dark" ? SKY_DUSK : SKY_DAY;
  // True once the visitor pressed pause, or never asked to play: scrolling back into view must not start it again then.
  const heldBack = React.useRef(false);

  // The card's growth, from the scroll position.
  React.useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      card.style.setProperty("--p", "1");
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const p = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * GROW_OVER)));
      card.style.setProperty("--p", p.toFixed(4));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, []);

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
      { threshold: 0.2 }
    );
    watcher.observe(video);
    return () => watcher.disconnect();
  }, []);

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

  return (
    <section
      className="relative overflow-hidden bg-theme-bg pb-10 sm:pb-14"
      style={{ paddingTop: `calc(${NAV_HEIGHT} + clamp(2rem, 5vw, 3.5rem))` }}
    >
      {/* The still is what the page paints first, so it is asked for at once. */}
      <link rel="preload" as="image" href={POSTER} fetchPriority="high" />

      {/* The sky: drifting clouds drawn live behind everything (the page colour shows if the browser has no WebGL). Its foot fades into the page
          colour so the next section starts clean. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <CloudShader
          className="absolute inset-0 h-full min-h-0"
          skyTopColor={sky.top}
          skyBottomColor={sky.bottom}
          cloudColor={sky.cloud}
          maxPixelRatio={1}
        />
        {/* A soft shade under the transparent menu bar, so its white links stay readable on the sky. */}
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/35 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-theme-bg" />
      </div>

      <div className="fluid-container relative z-10">
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

        {/* The animation card: the full width of the page. Its own background is white, so it shows as a card in both themes. */}
        <Reveal direction="up" delay={480} duration={900} distance={30} className="mt-10 sm:mt-14">
          <div
            ref={cardRef}
            className="relative aspect-video w-full overflow-hidden border border-theme-border bg-white shadow-2xl shadow-black/10 will-change-transform [--p:0]"
            style={{
              scale: "calc(0.88 + var(--p) * 0.12)",
              borderRadius: "calc(40px - var(--p) * 20px)",
              transformOrigin: "50% 0%",
            }}
          >
            <video
              ref={videoRef}
              className="absolute inset-0 h-full w-full object-cover will-change-transform"
              style={{ scale: "calc(1.1 - var(--p) * 0.1)" }}
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
              className="absolute bottom-4 right-4 flex size-10 cursor-pointer items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-md ring-1 ring-black/10 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
