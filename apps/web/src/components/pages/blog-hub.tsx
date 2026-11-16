import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { SegmentSection } from "@/components/segments/segment-parts";
import { ARTICLES, BLOG_CATEGORIES, BLOG_STARTS, findArticle } from "@/data/blog";
import { BlogList } from "./blog-list";
import { PageHero, PageShell } from "./page-shell";

/** The blog's front page: every article straight away, with a topic filter and search, then where to start for each decision. */
export function BlogHub() {
  return (
    <PageShell
      name="Blog"
      path="/blog"
      hero={
        <PageHero
          eyebrow="Blog"
          title="Straight answers for partners,"
          accent="owners and installers."
          body="Licences, connecting existing equipment, the WayTara gateway, EV chargers, subsidy and bills. Written plainly, checked against official sources, with no promises we cannot keep."
          primary={{ label: "Browse the articles", href: "#all" }}
          secondary={{ label: "Become a partner", href: "/partner" }}
        />
      }
    >
      <SegmentSection id="all" badge="All articles" title="Browse by" accent="topic." summary={`${ARTICLES.length} articles so far, and more added as we are asked.`}>
        <Reveal direction="up" duration={700} distance={16}>
          <BlogList articles={ARTICLES} categories={BLOG_CATEGORIES} />
        </Reveal>
      </SegmentSection>

      <SegmentSection id="start" badge="Start here" title="Start with" accent="your decision." summary="Pick the one you are facing, and read the articles that help.">
        <Reveal direction="up" duration={800} distance={24}>
          <ul className="grid grid-cols-1 gap-x-12 gap-y-12 md:grid-cols-2 lg:grid-cols-4">
            {BLOG_STARTS.map((g) => (
              <li key={g.title} className="border-t border-theme-border pt-6">
                <h3 className="text-xl font-bold tracking-tight text-theme-primary">{g.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-theme-secondary">{g.body}</p>
                <ul className="mt-5 space-y-3">
                  {g.slugs.map((slug) => {
                    const a = findArticle(slug);
                    if (!a) return null;
                    return (
                      <li key={slug}>
                        <Link href={a.path} className="group inline-flex items-start gap-1.5 text-[15px] font-semibold text-theme-highlight underline-offset-4 hover:underline">
                          {a.name}
                          <ArrowRight className="mt-1 size-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </Reveal>
      </SegmentSection>
    </PageShell>
  );
}
