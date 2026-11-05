import { Reveal } from "@/components/shared/reveal";
import { SectionHeader } from "@/components/shared/section-header";

const STEPS = [
  { title: "Assess", body: "We look at your property, how you use energy, and any equipment you already have." },
  { title: "Design", body: "We design the system around the site and what it needs to do." },
  { title: "Install and integrate", body: "We install the equipment and connect it to the WayTara dashboard." },
  { title: "Monitor and manage", body: "You see and manage your supported equipment from one place." },
];

/** How a project runs, in four steps. Customers who already own equipment join at step three. */
export function ProjectSteps() {
  return (
    <section id="how-a-project-works" className="section-padding bg-theme-bg scroll-mt-16">
      <div className="fluid-container">
        <Reveal direction="up" duration={700} distance={24}>
          <SectionHeader
            badge="How a project works"
            title="Four steps,"
            accent="one team."
            summary="Already have equipment? Start at step three."
          />
        </Reveal>

        <ol className="grid grid-cols-1 gap-y-10 md:grid-cols-4">
          {STEPS.map(({ title, body }, i) => (
            <li key={title}>
              <Reveal direction="up" duration={800} distance={24} delay={i * 120}>
                {/* The hairline runs along the top of the row; a green dot marks each step, the third one (where existing equipment joins) a ring. */}
                <div className="relative border-t border-theme-border pt-6 md:pr-8">
                  <span
                    className={
                      i === 2
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
