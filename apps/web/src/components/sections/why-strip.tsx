import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { cn } from "@/lib/utils";

const REASONS = [
  { title: "One accountable team", body: "The same team designs, installs and connects your system." },
  { title: "Engineered for your site", body: "Every system is designed around the property, not picked from a package." },
  { title: "Works with what you have", body: "Supported equipment you already own can join the same dashboard." },
];

/** Three short reasons to choose WayTara, with a way to the full Why WayTara page. */
export function WhyStrip() {
  return (
    <section id="why-waytara" className="section-padding bg-theme-bg scroll-mt-16">
      <div className="fluid-container">
        <Reveal direction="up" duration={800} distance={24}>
          <ul className="grid grid-cols-1 border-y border-theme-border md:grid-cols-3">
            {REASONS.map(({ title, body }, i) => (
              <li key={title} className={cn("py-8 md:px-8", i === 0 && "md:pl-0", i === REASONS.length - 1 && "md:pr-0", i > 0 && "border-t border-theme-border md:border-l md:border-t-0")}>
                <h3 className="text-base font-semibold text-theme-primary">{title}</h3>
                <p className="mt-1.5 max-w-[20rem] text-sm leading-relaxed text-theme-secondary">{body}</p>
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <Link href="/why-waytara" className="group inline-flex items-center gap-1.5 text-sm font-semibold text-theme-highlight hover:underline underline-offset-4">
              Why WayTara
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
