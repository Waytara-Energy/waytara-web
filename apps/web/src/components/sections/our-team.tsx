import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import { Reveal } from "@/components/shared/reveal";
import { SegmentSection } from "@/components/segments/segment-parts";

interface TeamMember {
  /** The photo is public/images/team/<slug>.webp (or .jpg, .jpeg, .png); until it is added the card shows the initials. */
  slug: string;
  name: string;
  role: string;
  /** Bold lead clause: the hook of the quote. */
  highlight: string;
  /** Regular-weight remainder, continuing straight on from `highlight`. */
  rest: string;
}

const TEAM: TeamMember[] = [
  {
    slug: "arun",
    name: "Arun V Mahadev",
    role: "Partner, WayTara",
    highlight: "I lead WayTara because every energy provider was building their own island — a separate app for solar, another for storage, another for EV.",
    rest: " We built the opposite instead — one platform where every source and every ecosystem comes together under a single account.",
  },
  {
    slug: "devaansh",
    name: "Devaansh Pujara",
    role: "Partner, WayTara",
    highlight: "At WayTara, I make sure building great technology isn’t enough — the installation, approvals, and years of upkeep after have to be just as disciplined.",
    rest: " My focus is making sure that promise holds up on every rooftop, not just in a product demo.",
  },
  {
    slug: "manoj",
    name: "Manoj Loganathan",
    role: "Software Engineer, WayTara",
    highlight: "I research and build WayTara’s technology end to end — the hardware integrations, the IoT and device communication, and the software that ties it all together.",
    rest: " My job is turning every new idea into something real, reliable, and ready for a customer’s rooftop.",
  },
];

/** The photo file a member has in public/images/team, if one has been added (checked when the page is built). */
function photoOf(slug: string): string | null {
  for (const ext of ["webp", "jpg", "jpeg", "png"]) {
    if (existsSync(path.join(process.cwd(), "public", "images", "team", `${slug}.${ext}`))) return `/images/team/${slug}.${ext}`;
  }
  return null;
}

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

/** The people behind WayTara: a portrait each, their name and role, and what they do in their own words. */
export function OurTeam() {
  return (
    <SegmentSection
      id="our-team"
      badge="Our team"
      title="The people building"
      accent="WayTara."
      summary="The people who design, build and support your system."
    >
      {/* Three people across, each with a portrait, name and role, and their quote. The three rows are shared (subgrid), so the portraits,
          the names and the quotes line up across the row whatever the length. */}
      <ul className="-mb-14 grid grid-cols-1 gap-x-12 md:grid-cols-3">
        {TEAM.map((member, i) => {
          const photo = photoOf(member.slug);
          return (
            <li key={member.slug} className="row-span-3 grid grid-rows-subgrid pb-14">
              <Reveal direction="up" duration={800} distance={24} delay={i * 110} className="row-span-3 grid grid-rows-subgrid">
                <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-theme-surface">
                  {photo ? (
                    <Image src={photo} alt={`${member.name}, ${member.role}`} fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-gradient-to-br from-emerald-500/15 via-theme-surface to-emerald-500/5" role="img" aria-label={`${member.name}, ${member.role}`}>
                      <span className="text-[clamp(4rem,9vw,6.5rem)] font-bold tracking-tight text-primary-gradient">{initials(member.name)}</span>
                    </div>
                  )}
                </div>
                <div className="mt-6">
                  <h3 className="text-lg font-bold tracking-tight text-theme-primary sm:text-xl">{member.name}</h3>
                  <p className="mt-1 text-sm text-theme-muted">{member.role}</p>
                </div>
                <p className="mt-4 text-pretty text-[15px] leading-relaxed sm:text-base">
                  <span className="font-semibold text-theme-primary">{member.highlight}</span>
                  <span className="text-theme-secondary">{member.rest}</span>
                </p>
              </Reveal>
            </li>
          );
        })}
      </ul>
    </SegmentSection>
  );
}
