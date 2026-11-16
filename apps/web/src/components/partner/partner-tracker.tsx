import Link from "next/link";
import { Check } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { PARTNER_TYPE_LABEL } from "@/lib/partner-network";
import { trackerFor, type TrackerStep } from "@/lib/partner-tracker";
import { cn } from "@/lib/utils";
import type { TrackedApplication } from "@/lib/partner-track-server";

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

/** The vertical list of steps: a tick for a finished one, a dotted ring for the one under way, a number for those ahead. */
function Steps({ steps }: { steps: TrackerStep[] }) {
  return (
    <ol className="relative">
      {steps.map((s, i) => (
        <li key={s.id} className="relative flex gap-4 pb-8 last:pb-0">
          {i < steps.length - 1 && <span aria-hidden="true" className="absolute left-4 top-9 -ml-px h-[calc(100%-2.25rem)] w-px bg-theme-border" />}
          <span
            aria-hidden="true"
            className={cn(
              "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium",
              s.state === "done" && "bg-theme-surface text-theme-primary",
              s.state === "current" && "border-2 border-dotted border-theme-primary bg-theme-bg",
              s.state === "todo" && "bg-theme-surface text-theme-muted",
            )}
          >
            {s.state === "done" ? <Check className="size-4" /> : s.state === "todo" ? i + 1 : null}
          </span>
          <span className="pt-0.5">
            <span className={cn("block text-[15px] leading-snug", s.state === "todo" ? "text-theme-muted" : "font-medium text-theme-primary")}>
              {s.title}
              <span className="sr-only">{s.state === "done" ? " (done)" : s.state === "current" ? " (in progress)" : " (not yet)"}</span>
            </span>
            <span className="mt-0.5 block text-sm text-theme-muted">{s.sub}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * The page an applicant opens from their e-mailed link: where they are in four steps and what we say about it, kept quiet and plain. On a wide screen the steps
 * are a column on the left and the current step is on the right; on a phone a slim progress bar sits on top, the current step follows, and the whole list opens
 * from one line.
 */
export function PartnerTracker({ app, children }: { app: TrackedApplication; children?: React.ReactNode }) {
  const view = trackerFor(app.status);
  const kind = app.partnerType ? PARTNER_TYPE_LABEL[app.partnerType] : null;
  const current = view.steps.find((s) => s.state === "current");
  return (
    <div className="min-h-dvh bg-theme-bg">
      <div className="fluid-container py-6 sm:py-8">
        <Logo />
      </div>

      <main className="fluid-container pb-20 pt-6 sm:pt-12">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-10 lg:grid-cols-[18rem_1fr] lg:gap-20">
          {/* a phone: a slim bar, then the full list on request */}
          <div className="lg:hidden">
            <p className="text-sm text-theme-muted">
              {view.stage === "closed" ? "Application closed" : `Step ${view.position} of ${view.steps.length}${current ? `: ${current.title}` : ""}`}
            </p>
            <div className="mt-3 grid grid-cols-4 gap-1.5" aria-hidden="true">
              {view.steps.map((s) => (
                <span key={s.id} className={cn("h-1 rounded-full", s.state === "todo" ? "bg-theme-border" : "bg-theme-primary")} />
              ))}
            </div>
            <details className="group mt-4 border-t border-theme-border pt-4">
              <summary className="cursor-pointer list-none text-sm font-medium text-theme-primary underline-offset-4 hover:underline">All steps</summary>
              <div className="mt-5">
                <Steps steps={view.steps} />
              </div>
            </details>
          </div>

          {/* a wide screen: the list on the left */}
          <aside className="hidden lg:block">
            <Steps steps={view.steps} />
            <div className="mt-10 border-t border-theme-border pt-6 text-sm text-theme-muted">
              Need help?{" "}
              <Link href="/contact" className="text-theme-primary underline underline-offset-4">
                Contact support
              </Link>
            </div>
          </aside>

          <section aria-labelledby="track-heading">
            <p className="text-sm text-theme-muted">Hi {app.firstName}</p>
            <h1 id="track-heading" className="mt-2 text-[clamp(1.6rem,3vw,2.2rem)] font-semibold leading-tight tracking-tight text-theme-primary">
              {view.headline}
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-theme-secondary">{view.body}</p>

            {app.message && (
              <div className="mt-8 max-w-xl border-l-2 border-theme-border pl-5">
                <p className="text-sm text-theme-muted">A note from our team{app.messageAt ? `, ${dateLabel(app.messageAt)}` : ""}</p>
                <p className="mt-1.5 whitespace-pre-line text-[15px] leading-relaxed text-theme-primary">{app.message}</p>
              </div>
            )}

            {children}

            <dl className="mt-10 max-w-xl divide-y divide-theme-border border-y border-theme-border text-sm">
              {app.reference && (
                <div className="flex justify-between gap-6 py-3">
                  <dt className="text-theme-muted">Reference</dt>
                  <dd className="font-medium tabular-nums text-theme-primary">{app.reference}</dd>
                </div>
              )}
              {kind && (
                <div className="flex justify-between gap-6 py-3">
                  <dt className="text-theme-muted">Applying as</dt>
                  <dd className="text-right text-theme-primary">{kind}</dd>
                </div>
              )}
              <div className="flex justify-between gap-6 py-3">
                <dt className="text-theme-muted">Applied on</dt>
                <dd className="text-theme-primary">{dateLabel(app.appliedOn)}</dd>
              </div>
            </dl>

            <p className="mt-8 max-w-xl text-xs leading-relaxed text-theme-muted">
              This page is private to you. Anyone with this link can see where your application is, so please keep it to yourself.
            </p>
            <p className="mt-6 text-sm text-theme-muted lg:hidden">
              Need help?{" "}
              <Link href="/contact" className="text-theme-primary underline underline-offset-4">
                Contact support
              </Link>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}

/** What a link that does not work shows: the same for one that is wrong, expired or replaced, so it tells a stranger nothing. */
export function PartnerTrackerClosed() {
  return (
    <div className="min-h-dvh bg-theme-bg">
      <div className="fluid-container py-6 sm:py-8">
        <Logo />
      </div>
      <main className="fluid-container pt-10 sm:pt-20">
        <div className="mx-auto max-w-xl">
          <h1 className="text-[clamp(1.6rem,3vw,2.2rem)] font-semibold leading-tight tracking-tight text-theme-primary">This link is not active</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-theme-secondary">
            It may have expired, or it may have been replaced by a newer one. If you applied recently, look in your e-mail for the latest message from us, or contact us and we will help.
          </p>
          <p className="mt-6 text-sm">
            <Link href="/contact" className="text-theme-primary underline underline-offset-4">
              Contact support
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
