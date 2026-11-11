import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { Mail, MessageCircle, Phone, MapPin } from "lucide-react";
import { SITE } from "@/lib/site";
import { LEGAL_LINKS, PARTNER_LINK, PRIMARY_LINKS, CONTACT_LINK, SOLUTION_SEGMENTS, GUIDE_LINKS } from "@/config/site-nav";

const COLUMN_TITLE = "text-xs sm:text-[13px] font-bold text-theme-primary tracking-tight";
const FOOTER_LINK = "hover:text-theme-primary transition-colors";

/** The easy ways in, on every page: plan a new system, check what you already have, manage it, or ask us. */
const GET_STARTED = [
  { label: "Plan my system", href: "/planner" },
  { label: "Check my equipment", href: "/technology#compatibility" },
  { label: "Manage my system", href: "/login" },
  { label: "Talk to us", href: "/contact" },
];

export function Footer() {
  return (
    <footer className="border-t border-black/[0.06] dark:border-white/[0.06] bg-theme-bg text-theme-secondary text-xs relative overflow-hidden">
      <div className="fluid-container pt-12 pb-8 relative z-10">

        {/* 1. Main row: the brand with the copyright line, then the link columns (the policy pages close the Company column) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 pb-10">

          <div className="lg:col-span-3 space-y-4">
            <Logo />
            <p className="text-xs text-theme-muted pt-1">© {new Date().getFullYear()} WayTara Energy LLP. All rights reserved.</p>
          </div>

          <div className="lg:col-span-9 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 sm:gap-8">

            <div className="space-y-3">
              <h4 className={COLUMN_TITLE}>Get started</h4>
              <ul className="space-y-2.5">
                {GET_STARTED.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={FOOTER_LINK}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className={COLUMN_TITLE}>Solutions</h4>
              <ul className="space-y-2.5">
                {SOLUTION_SEGMENTS.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={FOOTER_LINK}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className={COLUMN_TITLE}>Guides</h4>
              <ul className="space-y-2.5">
                {GUIDE_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={FOOTER_LINK}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className={COLUMN_TITLE}>Company</h4>
              <ul className="space-y-2.5">
                {[...PRIMARY_LINKS, PARTNER_LINK, { label: "Support", href: "/support" }, CONTACT_LINK].map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={FOOTER_LINK}>
                      {link.label}
                    </Link>
                  </li>
                ))}
                {/* The header's Get Started now leads to the planner, so customers find their way in here and in the mobile menu. */}
                <li>
                  <Link href="/login" className={FOOTER_LINK}>
                    Customer sign in
                  </Link>
                </li>
                {/* The policy pages, which used to sit in a bar at the very bottom. */}
                {LEGAL_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={FOOTER_LINK}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3 col-span-2 sm:col-span-1">
              <h4 className={COLUMN_TITLE}>Contact</h4>
              <ul className="space-y-2.5">
                <li className="space-y-1.5">
                  <a href={SITE.phoneHref} className={`flex items-center gap-2 ${FOOTER_LINK}`}>
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span>{SITE.phone}</span>
                  </a>
                  <a href={SITE.whatsapp} target="_blank" rel="noreferrer" className={`flex items-center gap-2 ${FOOTER_LINK}`}>
                    <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{SITE.whatsappPhone} (WhatsApp)</span>
                  </a>
                </li>
                <li>
                  <a href={SITE.instagram} target="_blank" rel="noreferrer" className={`flex items-center gap-2 ${FOOTER_LINK}`}>
                    <svg className="h-3.5 w-3.5 shrink-0 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24" aria-hidden="true">
                      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                    </svg>
                    <span>{SITE.instagramHandle}</span>
                  </a>
                </li>
                <li>
                  <a href="mailto:hello@waytaraenergy.com" className={`flex items-center gap-2 ${FOOTER_LINK}`}>
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span>hello@waytaraenergy.com</span>
                  </a>
                </li>
                <li>
                  <a
                    href={SITE.mapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`flex items-start gap-2 ${FOOTER_LINK}`}
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>No. 6 &amp; 7, 3rd floor 5th Street, Dr. Radhakrishnan Salai, Mylapore, Chennai</span>
                  </a>
                </li>
              </ul>
            </div>

          </div>
        </div>

        {/* 2. Brand watermark with a vertical fade (theme adaptive): the last thing on the page, with the footer's bottom padding under it */}
        <div
          className="mt-2 sm:mt-4 text-center select-none pointer-events-none overflow-hidden"
          style={{
            maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.16) 0%, rgba(0,0,0,0.04) 60%, rgba(0,0,0,0) 95%)",
            WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0.16) 0%, rgba(0,0,0,0.04) 60%, rgba(0,0,0,0) 95%)",
          }}
        >
          {/* The WayTara wordmark (the logo's own lettering, without "ENERGY"), used as a mask so it takes the theme's text colour. Same width as the plain text it replaced. */}
          <div
            aria-hidden="true"
            className="mx-auto aspect-[2172/458] w-[68vw] bg-current text-theme-primary"
            style={{
              maskImage: "url(/images/wordmark.png)",
              WebkitMaskImage: "url(/images/wordmark.png)",
              maskSize: "100% 100%",
              WebkitMaskSize: "100% 100%",
              maskRepeat: "no-repeat",
              WebkitMaskRepeat: "no-repeat",
            }}
          />
        </div>

      </div>
    </footer>
  );
}
