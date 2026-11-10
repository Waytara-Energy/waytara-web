"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Pause, Play } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";

const VIDEO = "/videos/energy-banner.mp4";
// A still of the street scene: shown while the video loads, and kept for visitors who ask for less motion or for less data.
const POSTER = "/videos/energy-banner-poster.webp";
// Height of the fixed menu bar (the same clamp the bar itself uses); the headline starts below it.
const NAV_HEIGHT = "clamp(3.5rem,4.5vw,4.25rem)";

/**
 * The top of the landing page: the promise in words, the way in (the planner), and under them a short animation of what the product is, a property with
 * solar, battery, inverter, gateway and charger, connected to the dashboard.
 *
 * The video has no sound, so it may start on its own. It is paused when it scrolls out of view (no work for something nobody sees), it does not start for
 * visitors who asked for less motion or for less data (they see the still and a play button), and everyone gets a pause button.
 */
export function Hero() {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = React.useState(false);
  // True once the visitor pressed pause, or never asked to play: scrolling back into view must not start it again then.
  const heldBack = React.useRef(false);

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

  // One clear main action: a pill with a green arrow, in the theme's own text colour so it reads in the light and the dark theme.
  const primaryButtonClass =
    "group inline-flex h-12 sm:h-[3.25rem] items-center gap-3 rounded-full bg-theme-primary pl-6 pr-1.5 text-sm sm:text-base font-semibold text-theme-bg shadow-lg shadow-black/15 transition-all duration-200 hover:scale-[1.03] active:scale-95 cursor-pointer";

  return (
    <section
      className="relative bg-theme-bg pb-10 sm:pb-14"
      style={{ paddingTop: `calc(${NAV_HEIGHT} + clamp(1.5rem, 4vw, 3rem))` }}
    >
      {/* The still is what the page paints first, so it is asked for at once. */}
      <link rel="preload" as="image" href={POSTER} fetchPriority="high" />

      <div className="fluid-container flex flex-col items-center text-center">
        <Reveal direction="up" delay={100} duration={800} distance={24}>
          <h1 className="font-bold tracking-tight leading-[1.05] text-theme-primary text-balance text-[clamp(2rem,4.6vw,4.5rem)]">
            <span className="block sm:whitespace-nowrap">Your property&rsquo;s energy,</span>
            <span className="block sm:whitespace-nowrap bg-gradient-to-r from-emerald-700 to-emerald-500 bg-clip-text text-transparent">
              built as one system.
            </span>
          </h1>
        </Reveal>

        <Reveal direction="up" delay={250} duration={800} distance={16} className="mt-5 max-w-2xl">
          <p className="text-[clamp(1.05rem,1.5vw,1.4rem)] font-semibold leading-snug text-theme-primary">
            Solar, battery storage and EV charging, designed, installed and managed together.
          </p>
          <p className="mt-2 text-sm sm:text-base leading-relaxed text-theme-secondary">
            Designed, installed and connected by one team. Already have equipment? Bring it into the same dashboard.
          </p>
        </Reveal>

        <Reveal direction="zoom" delay={400} duration={700} className="mt-7">
          <Link href="/planner" className={primaryButtonClass}>
            <span>Plan my system</span>
            <span className="flex size-9 sm:size-10 items-center justify-center rounded-full bg-emerald-600 text-white transition-transform duration-200 group-hover:translate-x-0.5">
              <ArrowRight className="size-4" />
            </span>
          </Link>
        </Reveal>

        {/* The animation. Its own background is white, so it sits in a framed card in both themes. As wide as the page allows, but never so tall that
            it pushes the headline off the first screen. */}
        <Reveal direction="up" delay={550} duration={900} distance={30} className="mt-8 sm:mt-10 w-full">
          <div
            className="relative mx-auto aspect-video w-full overflow-hidden rounded-2xl border border-theme-border bg-white shadow-xl shadow-black/10"
            style={{ maxWidth: "min(100%, max(40rem, calc((100dvh - 22rem) * 16 / 9)))" }}
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
              className="absolute bottom-3 right-3 flex size-10 cursor-pointer items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-md ring-1 ring-black/10 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
