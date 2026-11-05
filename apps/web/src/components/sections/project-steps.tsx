import { Reveal } from "@/components/shared/reveal";
import { SectionHeader } from "@/components/shared/section-header";
import { cn } from "@/lib/utils";

interface Step {
  title: string;
  body: string;
  /** A short label at the end of the step's line (who does it, or where): optional. */
  tag?: string;
}

const STEPS: Step[] = [
  { title: "Assess", body: "We look at your property, how you use energy, and any equipment you already have.", tag: "With you" },
  { title: "Design", body: "We design the system around the site and what it needs to do.", tag: "Our engineers" },
  { title: "Install and integrate", body: "We install the equipment and connect it to the WayTara dashboard.", tag: "On site" },
  { title: "Monitor and manage", body: "You see and manage your supported equipment from one place.", tag: "Your dashboard" },
];

interface ProjectStepsProps {
  id?: string;
  /** Replaces the default four steps (landing page wording). */
  steps?: Step[];
  badge?: string;
  title?: string;
  accent?: string;
  summary?: string;
  /** The step (0-based) where equipment a customer already owns joins; its number is drawn filled. Only the default steps have one. */
  ringAt?: number;
}

/**
 * How a project runs, as numbered steps. Each step is a numbered circle with a line running to a short label, then a large title and a short
 * description (the same look as the figures-and-timeline cards used earlier in the site). Customers who already own equipment join at the filled step.
 */
export function ProjectSteps({
  id = "how-a-project-works",
  steps = STEPS,
  badge = "How a project works",
  title = "Four steps,",
  accent = "one team.",
  summary = "Already have equipment? Start at step three.",
  ringAt,
}: ProjectStepsProps) {
  const ring = ringAt ?? (steps === STEPS ? 2 : -1);
  const five = steps.length === 5;
  return (
    <section id={id} className="section-padding bg-theme-bg scroll-mt-28">
      <div className="fluid-container">
        <Reveal direction="up" duration={700} distance={24}>
          <SectionHeader badge={badge} title={title} accent={accent} summary={summary} />
        </Reveal>

        <ol className={cn("grid grid-cols-1 gap-x-10 gap-y-12", five ? "md:grid-cols-5 md:gap-x-8" : "md:grid-cols-4 lg:gap-x-12")}>
          {steps.map(({ title: stepTitle, body, tag }, i) => (
            <li key={stepTitle}>
              <Reveal direction="up" duration={800} distance={24} delay={i * 120}>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold tabular-nums",
                      i === ring ? "border-emerald-500 bg-emerald-500 text-white" : "border-emerald-500/70 bg-theme-bg text-emerald-700 dark:text-emerald-400"
                    )}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="h-px flex-1 bg-gradient-to-r from-emerald-500/70 to-theme-border" aria-hidden="true" />
                  {tag && <span className="shrink-0 text-xs font-semibold text-theme-muted sm:text-[13px]">{tag}</span>}
                </div>
                <h3
                  className={cn(
                    "mt-5 font-bold leading-tight tracking-tight",
                    five ? "text-[clamp(1.2rem,1.7vw,1.6rem)]" : "text-[clamp(1.5rem,2.3vw,2.2rem)]",
                    i % 2 === 0 ? "text-primary-gradient" : "text-theme-primary"
                  )}
                >
                  {stepTitle}
                </h3>
                <p className="mt-3 max-w-[22rem] text-sm leading-relaxed text-theme-secondary">{body}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
