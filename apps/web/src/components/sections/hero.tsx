"use client";

import * as React from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowRight, Pause, Play } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { CloudShader } from "@/components/ui/cloud-shader";
import { FlipWords } from "@/components/ui/flip-words";
import { useHasMounted } from "@/hooks/use-has-mounted";

const VIDEO = "/videos/energy-banner.mp4";
// A still of the street scene: shown while the video loads, and kept for visitors who ask for less motion or for less data.
const POSTER = "/videos/energy-banner-poster.webp";
// The words that take turns in the headline, each one an action the platform does for the whole property.
const HEADLINE_WORDS = ["Connect.", "Monitor.", "Control.", "Optimise."];
// The sky behind the top of the hero: the day sky and, in the dark theme, the same sky at dusk.
const SKY_DAY = { top: "#3876ba", bottom: "#8cbfe8", cloud: "#fbf8f2" };
const SKY_DUSK = { top: "#070d1f", bottom: "#1b2a4a", cloud: "#8d9bb8" };

// The height of the first screen (never shorter than 620 px): the sky is as tall as that and stays in place while the page scrolls over it.
const SCENE_H = "max(100dvh, 620px)";
// (--sky is set on the section: 0.3 on a normal screen, 0.18 on a phone.)
// The layer the content sits on is clear at the top (the sky shows through), fades into the page colour by 30 percent of the first screen, and is the
// page colour from there on down. So only the top 30 percent of the screen shows clouds, and as the page scrolls this layer, carrying the content,
// rises over them and hides them.
const OVERLAY = `linear-gradient(to bottom, transparent 0, transparent calc(${SCENE_H} * var(--sky) * 0.27), var(--background) calc(${SCENE_H} * var(--sky)))`;
// The headline starts just below the part where the sky shows.
const TEXT_TOP = `calc(${SCENE_H} * var(--sky) + clamp(1rem, 2vw, 1.5rem))`;

// Whether the visitor asked for less motion. The server-built page assumes not; a visitor who did gets a still word and no autoplaying video.
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const readReducedMotion = () => window.matchMedia(REDUCED_MOTION).matches;
const serverReducedMotion = () => false;

/**
 * The top of the landing page: the cloud sky shows in the top 30 percent of the first screen and fades into the page colour; the headline, one line and
 * two buttons sit on that, and under them the animation card at the width of the text column. Nothing is animated by scrolling except that the page
 * itself moves: the sky stays where it is, and the page-coloured layer with the content scrolls up over it and covers the clouds.
 *
 * The video has no sound, so it may start on its own. It is paused while out of view, it does not start for visitors who asked for less motion or for
 * less data (they see the still and a play button), and everyone gets a pause button.
 */
export function Hero() {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const reduced = React.useSyncExternalStore(subscribeReducedMotion, readReducedMotion, serverReducedMotion);
  // The theme is not known until the page has loaded in the browser, so the server-built page always has the day sky.
  const { resolvedTheme } = useTheme();
  const mounted = useHasMounted();
  const sky = mounted && resolvedTheme === "dark" ? SKY_DUSK : SKY_DAY;
  // True once the visitor pressed pause, or never asked to play: scrolling back into view must not start it again then.
  const heldBack = React.useRef(false);

  // Play and pause.
  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // The video may have started before this page was ready to hear about it, so ask it rather than wait for an event.
    setPlaying(!video.paused);

    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (window.matchMedia(REDUCED_MOTION).matches || connection?.saveData) {
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
      { threshold: 0.05 }
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
    "inline-flex h-12 sm:h-[3.25rem] items-center rounded-full text-sm sm:text-base font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-theme-bg";

  return (
    <section className="relative bg-theme-bg [--sky:0.18] sm:[--sky:0.3]">
      {/* The still is what the page paints first, so it is asked for at once. */}
      <link rel="preload" as="image" href={POSTER} fetchPriority="high" />

      {/* 1. The sky: one screen tall, stuck to the top of the window while this section is on screen, taking no room of its own (the negative margin).
          The layer below scrolls over it. A soft shade under the menu bar keeps its white links readable on the sky. */}
      <div
        aria-hidden="true"
        className="pointer-events-none sticky top-0 overflow-hidden bg-gradient-to-b from-[#3876ba] to-[#8cbfe8]"
        style={{ height: SCENE_H, marginBottom: `calc(${SCENE_H} * -1)` }}
      >
        <CloudShader
          className="absolute inset-0 h-full min-h-0"
          skyTopColor={sky.top}
          skyBottomColor={sky.bottom}
          cloudColor={sky.cloud}
          maxPixelRatio={1}
        />
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/35 to-transparent" />
      </div>

      {/* 2. The layer with the content: clear at the top, the page colour from 30 percent down, scrolling with the page. */}
      <div
        data-hero-overlay=""
        className="relative z-10 flex min-h-dvh flex-col pb-5 sm:block sm:min-h-0 sm:pb-16"
        style={{ background: OVERLAY, paddingTop: TEXT_TOP }}
      >
        <div className="fluid-container flex w-full flex-1 flex-col sm:block">
          <Reveal direction="up" delay={100} duration={800} distance={24}>
            <h1 className="font-bold tracking-tight leading-[1.05] text-theme-primary text-balance text-[clamp(2rem,4.4vw,4.25rem)]">
              {/* The whole sentence for screen readers, search engines and anyone without the animation; the visible two lines below are hidden from them. */}
              <span className="sr-only">One platform to connect, monitor, control and optimise your entire energy ecosystem.</span>
              <span aria-hidden="true" className="block">
                <span className="block sm:whitespace-nowrap">
                  One platform to{" "}
                  <FlipWords
                    words={HEADLINE_WORDS}
                    still={reduced}
                    className="bg-gradient-to-r from-emerald-600 via-green-500 to-lime-500 bg-clip-text text-transparent dark:from-emerald-300 dark:via-green-400 dark:to-lime-300"
                  />
                </span>
                <span className="block sm:whitespace-nowrap">Your entire energy ecosystem.</span>
              </span>
            </h1>
          </Reveal>

          <Reveal direction="up" delay={220} duration={800} distance={16} className="mt-5 max-w-[52rem]">
            {/* Two lines on a wide screen (the box is just wide enough, and text-balance evens the two out); it wraps to more on a narrow one. */}
            <p className="text-balance text-[clamp(1rem,1.3vw,1.2rem)] leading-relaxed text-theme-secondary">
              Connect solar, batteries, EV chargers, meters and more through WayTara&rsquo;s flexible gateway and unified platform, built for new and existing energy infrastructure.
            </p>
          </Reveal>

          <Reveal direction="up" delay={340} duration={700} distance={12} className="mt-6 flex flex-wrap items-center gap-3 sm:mt-7">
            {/* The main action: the site's green gradient, white text, and the arrow in a white circle. */}
            <Link
              href="/planner"
              className={`${buttonBase} group gap-3 bg-primary-gradient pl-6 pr-1.5 text-white shadow-lg shadow-emerald-900/20 transition-all duration-200 hover:brightness-95 hover:shadow-xl active:scale-95`}
            >
              <span>Plan my system</span>
              <span className="flex size-9 sm:size-10 items-center justify-center rounded-full bg-white text-slate-950 transition-transform duration-200 group-hover:translate-x-0.5">
                <ArrowRight className="size-4" />
              </span>
            </Link>
            {/* The second action: quiet until pointed at, then filled with the brand green. (Plain colour classes on purpose: the site's unlayered theme-*
                classes would override the hover colours.) */}
            <Link
              href="/contact"
              className={`${buttonBase} border border-slate-300 bg-slate-50 px-6 text-slate-900 transition-colors duration-200 hover:border-emerald-600 hover:bg-emerald-600 hover:text-white dark:border-white/20 dark:bg-white/5 dark:text-slate-50 dark:hover:border-emerald-500 dark:hover:bg-emerald-500`}
            >
              Talk to us
            </Link>
          </Reveal>

          {/* 3. The animation card: the width of the text column, with a shadow. Its own background is white, so it shows as a card in both themes. */}
          <Reveal direction="up" delay={480} duration={900} distance={30} className="mt-auto pt-7 sm:mt-12 sm:pt-0">
            <div className="relative aspect-video w-full overflow-hidden rounded-[20px] bg-white shadow-2xl shadow-black/25 sm:rounded-[28px]">
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
          </Reveal>
        </div>
      </div>
    </section>
  );
}
