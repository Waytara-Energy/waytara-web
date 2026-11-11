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

// The height of the first screen (never shorter than 620 px).
const SCENE_H = "max(100dvh, 620px)";
// The sky is pinned in place while the page scrolls over it, but it is only 60 percent of the screen tall (the page-coloured layer covers everything
// below the clouds anyway). It must NOT reach the bottom edge of the screen: on an iPhone, Safari tints its toolbars with the colour of whatever is
// pinned against the screen's edges, so a full-height sky turned the bottom toolbar (and the status bar) solid blue.
const SKY_H = "max(60dvh, 372px)";
// (--sky, --fade and --text-gap are set on the section. On a normal screen: 0.3, 1 and 1.5rem. On a phone all three are 0: the layer is clear, the
// content starts at its top, and the sky is shown instead in the room that is left over on the first screen, by the spacer below.)
// The layer the content sits on is clear at the top (the sky shows through), fades into the page colour by 30 percent of the first screen, and is the
// page colour from there on down. So only the top 30 percent of the screen shows clouds, and as the page scrolls this layer, carrying the content,
// rises over them and hides them.
const OVERLAY = `linear-gradient(to bottom, transparent 0, transparent calc(${SCENE_H} * var(--sky) * 0.27), color-mix(in srgb, var(--background) calc(var(--fade) * 100%), transparent) calc(${SCENE_H} * var(--sky)))`;
// The headline starts just below the part where the sky shows.
const TEXT_TOP = `calc(${SCENE_H} * var(--sky) + var(--text-gap))`;
// The same fade for the phone's spacer: clear at the top, the page colour at its foot.
const SPACER = "linear-gradient(to bottom, transparent 0, transparent 27%, var(--background) 100%)";

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
    "inline-flex h-[40px] sm:h-[3.25rem] items-center rounded-full text-sm sm:text-base font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-theme-bg";

  return (
    <section className="relative bg-theme-bg [--sky:0] [--fade:0] [--text-gap:0px] sm:[--sky:0.3] sm:[--fade:1] sm:[--text-gap:1.5rem]">
      {/* The still is what the page paints first, so it is asked for at once. */}
      <link rel="preload" as="image" href={POSTER} fetchPriority="high" />

      {/* 1. The sky: 60 percent of a screen tall, stuck to the top of the window while this section is on screen, taking no room of its own (the negative
          margin). The layer below scrolls over it. On a wide screen a soft shade under the menu bar keeps its white links readable on the sky; on a phone
          there is none, so that the top edge is the sky's own colour and the status bar above it (which Safari fills with that colour) blends in. */}
      <div
        aria-hidden="true"
        className="pointer-events-none sticky top-0 overflow-hidden bg-gradient-to-b from-[#3876ba] to-[#8cbfe8]"
        style={{ height: SKY_H, marginBottom: `calc(${SKY_H} * -1)` }}
      >
        <CloudShader
          className="absolute inset-0 h-full min-h-0"
          skyTopColor={sky.top}
          skyBottomColor={sky.bottom}
          cloudColor={sky.cloud}
          maxPixelRatio={1}
        />
        <div className="absolute inset-x-0 top-0 hidden h-28 bg-gradient-to-b from-black/35 to-transparent sm:block" />
      </div>

      {/* 2. The layer with the content: clear at the top, the page colour from 30 percent down, scrolling with the page. */}
      <div
        data-hero-overlay=""
        className="relative z-10 flex min-h-dvh flex-col sm:block sm:min-h-0"
        style={{ background: OVERLAY, paddingTop: TEXT_TOP }}
      >
        {/* Phone only: whatever room the content leaves on the first screen is the sky, fading into the page colour just above the headline. This
            puts the card right under the buttons and the clouds at the top (instead of a gap in the middle). */}
        <div aria-hidden="true" className="min-h-16 flex-1 sm:hidden" style={{ background: SPACER }} />

        {/* The content block has the page colour itself (on a phone the layer around it is clear). */}
        <div className="fluid-container w-full bg-theme-bg pb-5 sm:pb-16">
          <Reveal direction="up" delay={100} duration={800} distance={24}>
            <h1 className="text-left font-semibold leading-[1.18] tracking-tight text-theme-primary text-[clamp(19px,5.8vw,25px)] sm:font-bold sm:leading-[1.05] sm:text-[clamp(2rem,4.4vw,4.25rem)]">
              {/* The whole sentence for screen readers, search engines and anyone without the animation; the visible two lines below are hidden from them. */}
              <span className="sr-only">One platform to connect, monitor, control and optimise your entire energy ecosystem.</span>
              <span aria-hidden="true" className="block">
                <span className="block whitespace-nowrap max-[340px]:whitespace-normal">
                  One platform to{" "}
                  <FlipWords
                    words={HEADLINE_WORDS}
                    still={reduced}
                    className="bg-gradient-to-r from-emerald-600 via-green-500 to-lime-500 bg-clip-text text-transparent dark:from-emerald-300 dark:via-green-400 dark:to-lime-300"
                  />
                </span>
                <span className="block whitespace-nowrap max-[340px]:whitespace-normal">Your entire energy ecosystem.</span>
              </span>
            </h1>
          </Reveal>

          <Reveal direction="up" delay={220} duration={800} distance={16} className="mt-3 sm:mt-5">
            {/* One short sentence: a single line from a tablet up, two on a phone. */}
            <p className="text-pretty text-[15px] leading-[1.55] text-theme-secondary sm:text-[clamp(1rem,1.3vw,1.2rem)] sm:leading-relaxed">
              Connect solar, batteries, EV chargers and meters, new or existing, through WayTara&rsquo;s gateway.
            </p>
          </Reveal>

          <Reveal direction="up" delay={340} duration={700} distance={12} className="mt-5 flex w-full items-center gap-2 sm:mt-7 sm:w-auto sm:flex-wrap sm:gap-3">
            {/* The main action: the site's green gradient, white text, and the arrow in a white circle. */}
            <Link
              href="/planner"
              className={`${buttonBase} group gap-2.5 bg-primary-gradient pl-5 pr-1.5 sm:gap-3 sm:pl-6 text-white shadow-lg shadow-emerald-900/20 transition-all duration-200 hover:brightness-95 hover:shadow-xl active:scale-95`}
            >
              <span>Plan my system</span>
              <span className="flex size-[30px] sm:size-10 items-center justify-center rounded-full bg-white text-slate-950 transition-transform duration-200 group-hover:translate-x-0.5">
                <ArrowRight className="size-3.5 sm:size-4" />
              </span>
            </Link>
            {/* The second action: quiet until pointed at, then filled with the brand green. (Plain colour classes on purpose: the site's unlayered theme-*
                classes would override the hover colours.) */}
            <Link
              href="/contact"
              className={`${buttonBase} border border-slate-300 bg-slate-50 px-5 text-slate-900 sm:px-6 transition-colors duration-200 hover:border-emerald-600 hover:bg-emerald-600 hover:text-white dark:border-white/20 dark:bg-white/5 dark:text-slate-50 dark:hover:border-emerald-500 dark:hover:bg-emerald-500`}
            >
              Talk to us
            </Link>
          </Reveal>

          {/* 3. The animation. On a phone: a strip the full width of the screen between two hairlines, (as on Framer's page). From a tablet up: the card the width of the text column, with rounded corners and a shadow. Its own background is white in both themes. */}
          <Reveal direction="up" delay={480} duration={900} distance={30} className="-mx-[var(--page-gutter)] mt-7 sm:mx-0 sm:mt-12">
            <div className="relative aspect-video w-full overflow-hidden border-y border-theme-border bg-white sm:rounded-[28px] sm:border-0 sm:shadow-2xl sm:shadow-black/25">
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
                className="absolute bottom-3 right-3 flex size-[34px] cursor-pointer items-center justify-center rounded-full bg-black/70 text-white ring-1 ring-white/20 backdrop-blur-sm transition hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:bottom-5 sm:right-5 sm:size-11"
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
