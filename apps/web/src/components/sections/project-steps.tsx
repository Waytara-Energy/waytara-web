import { Reveal } from "@/components/shared/reveal";
import { SectionHeader } from "@/components/shared/section-header";

interface Step {
  title: string;
  body: string;
}

const STEPS: Step[] = [
  { title: "Assess", body: "We look at your property, how you use energy, and any equipment you already have." },
  { title: "Design", body: "We design the system around the site and what it needs to do." },
  { title: "Install and integrate", body: "We install the equipment and connect it to the WayTara dashboard." },
  { title: "Monitor and manage", body: "You see and manage your supported equipment from one place." },
];

/** How a project runs, in four steps. Customers who already own equipment join at step three. */
interface ProjectStepsProps {
  id?: string;
  /** Replaces the default four steps (landing page wording). */
  steps?: Step[];
  badge?: string;
  title?: string;
  accent?: string;
  summary?: string;
  /** The step (0-based) where equipment a customer already owns joins; drawn as a ring. Only the default steps have one. */
  ringAt?: number;
}

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
  return (
    <section id={id} className="section-padding bg-theme-bg scroll-mt-28">
      <div className="fluid-container">
        <Reveal direction="up" duration={700} distance={24}>
          <SectionHeader
            badge={badge}
            title={title}
            accent={accent}
            summary={summary}
          />
        </Reveal>

        <ol className={steps.length === 5 ? "grid grid-cols-1 gap-y-10 md:grid-cols-5" : "grid grid-cols-1 gap-y-10 md:grid-cols-4"}>
          {steps.map(({ title, body }, i) => (
            <li key={title}>
              <Reveal direction="up" duration={800} distance={24} delay={i * 120}>
                {/* The hairline runs along the top of the row; a green dot marks each step, the third one (where existing equipment joins) a ring. */}
                <div className="relative border-t border-theme-border pt-6 md:pr-8">
                  <span
                    className={
                      i === ring
                        ? "absolute -top-[5px] left-0 size-[9px] rounded-full border-2 border-emerald-500 bg-theme-bg"
                        : "absolute -top-[5px] left-0 size-[9px] rounded-full bg-emerald-500"
                    }
                    aria-hidden="true"
                  />
                  <p className="text-xs font-semibold tabular-nums text-theme-muted">{String(i + 1).padStart(2, "0")}</p>
                  <h3 className="mt-2 text-base font-semibold text-theme-primary">{title}</h3>
                  <p className="mt-1.5 max-w-[17rem] text-sm leading-relaxed text-theme-secondary">{body}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
