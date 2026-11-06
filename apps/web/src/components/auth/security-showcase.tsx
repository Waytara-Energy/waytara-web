"use client";

import * as React from "react";
import { BellRing, CheckCircle2, History, Laptop, Mail, ShieldCheck, Smartphone, Timer, TimerReset, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { cn } from "@/lib/utils";
import { SLIDE_MS, SlideBars, useMedia, useReducedMotion } from "./login-showcase";

interface Slide {
  title: string;
  accent: string;
  body: string;
  visual: "code" | "notice" | "password" | "devices" | "second-step";
}

/** Five protections the account really has (each one exists in the product today), told one at a time. */
const SLIDES: Slide[] = [
  {
    title: "A code only you",
    accent: "can use.",
    body: "A 6-digit code goes to the e-mail address on your account. It works once, lasts 10 minutes, and allows 5 tries.",
    visual: "code",
  },
  {
    title: "We tell you",
    accent: "when it changes.",
    body: "The moment your password changes, we e-mail you, so you would know straight away if it was not you.",
    visual: "notice",
  },
  {
    title: "Your password",
    accent: "stays yours.",
    body: "It is never stored in a readable form, never shown to our team and never sent to you by e-mail.",
    visual: "password",
  },
  {
    title: "See where you are",
    accent: "signed in.",
    body: "Settings lists your recent sign-ins and devices, and lets you sign out of the others in one tap.",
    visual: "devices",
  },
  {
    title: "Add a second step",
    accent: "if you want one.",
    body: "Turn on two-step sign-in and a code from your authenticator app is needed as well as your password.",
    visual: "second-step",
  },
];

/** What else protects the account, shown under the slides all the time (each of these exists in Settings today). */
const ALSO: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: ShieldCheck, title: "Two-step sign-in", body: "Add a code from your authenticator app." },
  { icon: BellRing, title: "Sign-in alerts", body: "An e-mail when someone signs in, if you want it." },
  { icon: History, title: "Activity history", body: "Your recent sign-ins and devices, in Settings." },
  { icon: TimerReset, title: "Automatic sign-out", body: "Choose how long an idle session stays open." },
];

/** The shell of each little illustration: one soft card, in the site's own look. */
function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("w-full max-w-md rounded-3xl border border-black/10 bg-theme-bg p-6 dark:border-white/15", className)}>{children}</div>;
}

function CodeBoxes({ digits }: { digits: string }) {
  return (
    <div className="flex gap-2">
      {digits.split("").map((d, i) => (
        <span key={i} className="flex size-12 flex-1 items-center justify-center rounded-xl border border-emerald-500/50 bg-emerald-500/5 text-xl font-bold tabular-nums text-theme-primary">
          {d}
        </span>
      ))}
    </div>
  );
}

function Visual({ kind }: { kind: Slide["visual"] }) {
  switch (kind) {
    case "code":
      return (
        <Card>
          <p className="text-sm font-semibold text-theme-muted">Verification code</p>
          <div className="mt-4">
            <CodeBoxes digits="482915" />
          </div>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-theme-secondary">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-theme-border px-3 py-1.5">
              <Timer className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" /> Valid for 10 minutes
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-theme-border px-3 py-1.5">
              <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" /> Works once
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-theme-border px-3 py-1.5">5 tries</span>
          </div>
        </Card>
      );
    case "notice":
      return (
        <Card>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Mail className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold text-theme-primary">Your WayTara password was changed</p>
              <p className="text-xs text-theme-muted">hello@waytaraenergy.com · just now</p>
            </div>
          </div>
          <div className="mt-5 space-y-2 border-t border-theme-border pt-4 text-sm text-theme-secondary">
            <p className="flex justify-between gap-4">
              <span className="text-theme-muted">Device</span>
              <span className="font-medium text-theme-primary">Chrome on Windows</span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-theme-muted">Place</span>
              <span className="font-medium text-theme-primary">Chennai, Tamil Nadu</span>
            </p>
            <p className="pt-2 text-xs text-theme-muted">Not you? Sign in and review your activity straight away.</p>
          </div>
        </Card>
      );
    case "password":
      return (
        <Card>
          <p className="text-sm font-semibold text-theme-muted">New password</p>
          <div className="mt-3 rounded-xl border border-theme-border bg-theme-surface px-4 py-3 text-lg tracking-[0.3em] text-theme-primary">••••••••••••</div>
          <div className="mt-4 flex items-center gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="h-1.5 flex-1 rounded-full bg-emerald-500" />
            ))}
            <span className="ml-3 text-xs font-semibold text-theme-secondary">Strong</span>
          </div>
          <p className="mt-3 text-xs text-theme-muted">Longer is stronger: 12 or more characters.</p>
        </Card>
      );
    case "devices":
      return (
        <Card>
          <p className="text-sm font-semibold text-theme-muted">Your devices</p>
          <ul className="mt-4 space-y-4">
            <li className="flex items-center gap-3">
              <Laptop className="size-5 text-theme-secondary" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-theme-primary">Chrome on Windows</p>
                <p className="text-xs text-theme-muted">Chennai · this device</p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-3.5" aria-hidden="true" /> Active now
              </span>
            </li>
            <li className="flex items-center gap-3 border-t border-theme-border pt-4">
              <Smartphone className="size-5 text-theme-secondary" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-theme-primary">Chrome on Android</p>
                <p className="text-xs text-theme-muted">Chennai · 2 days ago</p>
              </div>
              <span className="text-xs font-semibold text-theme-highlight">Sign out</span>
            </li>
          </ul>
        </Card>
      );
    case "second-step":
      return (
        <Card>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold text-theme-primary">Two-step sign-in</p>
              <p className="text-xs text-theme-muted">Code from your authenticator app</p>
            </div>
          </div>
          <div className="mt-5">
            <CodeBoxes digits="739204" />
          </div>
          <p className="mt-4 text-xs text-theme-muted">A new code every 30 seconds.</p>
        </Card>
      );
  }
}

/**
 * The left half of the password-recovery pages: the same layout as the sign-in page (logo, one idea at a time, bars that fill, edge to edge), but showing how the
 * account is protected instead of the dashboard. Wide screens only. The slides advance by themselves, stop while the pointer is over the panel, and do not move at all
 * for visitors who ask for less motion.
 */
export function SecurityShowcase() {
  const wide = useMedia("(min-width: 1024px)");
  const still = useReducedMotion();
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);

  React.useEffect(() => {
    if (!wide || paused || still) return;
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % SLIDES.length), SLIDE_MS);
    return () => window.clearTimeout(id);
  }, [wide, paused, still, index]);

  const slide = SLIDES[index];
  const edge = "pl-16 pr-16 xl:pl-20 xl:pr-20";
  return (
    <div className="relative hidden w-1/2 flex-col overflow-hidden bg-theme-bg lg:flex" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className={cn("relative pt-20 xl:pt-24", edge)}>
        <Logo />
      </div>

      <div key={index} className={cn("login-slide relative mt-10", edge)}>
        <h2 className="max-w-xl text-[clamp(2rem,3.2vw,3rem)] font-bold leading-[1.1] tracking-tight text-theme-primary" aria-live="polite">
          {slide.title}
          <span className="block text-primary-gradient">{slide.accent}</span>
        </h2>
        <p className="mt-4 max-w-md text-[clamp(1rem,1.2vw,1.125rem)] leading-snug text-theme-secondary">{slide.body}</p>
      </div>

      <div className={cn("relative mt-10 min-h-0 flex-1", edge)}>
        <div key={`v${index}`} className="login-slide-late" aria-hidden="true">
          <Visual kind={slide.visual} />
        </div>

        {/* the rest of the protection, always in view; only where the screen is tall enough to show it above the bars */}
        <div className="mt-9 hidden max-w-md [@media(min-height:860px)]:block">
          <p className="text-sm font-semibold text-theme-muted">Also protecting your account</p>
          <ul className="mt-4 grid grid-cols-2 gap-x-8 gap-y-5">
            {ALSO.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex items-start gap-3">
                <Icon className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-theme-primary">{title}</p>
                  <p className="mt-0.5 text-[13px] leading-snug text-theme-secondary">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className={cn("absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-theme-bg via-theme-bg/90 to-transparent pb-7 pt-16", edge)}>
        <SlideBars slides={SLIDES} index={index} setIndex={setIndex} paused={paused} still={still} />
      </div>
    </div>
  );
}
