import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { Mail, Phone, MapPin } from "lucide-react";
import { TEMP_HIDE_LANDING_SECTIONS } from "@/config/landing-flags";
import { LEGAL_LINKS, PARTNER_LINK, PRIMARY_LINKS, CONTACT_LINK, SOLUTION_SEGMENTS } from "@/config/site-nav";

const COLUMN_TITLE = "text-xs sm:text-[13px] font-bold text-theme-primary tracking-tight";
const FOOTER_LINK = "hover:text-theme-primary transition-colors";

export function Footer() {
  return (
    <footer className="border-t border-black/[0.06] dark:border-white/[0.06] bg-theme-bg text-theme-secondary text-xs relative overflow-hidden">
      <div className="fluid-container pt-12 pb-8 relative z-10">

        {/* 1. Main row: brand and one line about what WayTara does, then three short columns */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 pb-10">

          <div className="lg:col-span-4 space-y-4">
            <Logo />
            <p className="text-sm sm:text-[15px] text-theme-primary leading-relaxed font-medium max-w-sm pt-1">
              WayTara designs, installs and manages solar, battery storage and EV charging as one connected energy system.
            </p>
          </div>

          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-6 sm:gap-8">

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
              <h4 className={COLUMN_TITLE}>Company</h4>
              <ul className="space-y-2.5">
                {[...PRIMARY_LINKS, PARTNER_LINK, CONTACT_LINK].map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={FOOTER_LINK}>
                      {link.label}
                    </Link>
                  </li>
                ))}
                {/* TEMP_HIDE_LANDING_SECTIONS (src/config/landing-flags.ts) — the Knowledge Centre is hidden while the flag is on. */}
                {!TEMP_HIDE_LANDING_SECTIONS && (
                  <li>
                    <Link href="/knowledge-centre" className={FOOTER_LINK}>
                      Knowledge Centre
                    </Link>
                  </li>
                )}
                {/* The header's Get Started now leads to the planner, so customers find their way in here and in the mobile menu. */}
                <li>
                  <Link href="/login" className={FOOTER_LINK}>
                    Customer sign in
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-3 col-span-2 sm:col-span-1">
              <h4 className={COLUMN_TITLE}>Contact</h4>
              <ul className="space-y-2.5">
                <li className="space-y-1.5">
                  <a href="tel:9363021195" className={`flex items-center gap-2 ${FOOTER_LINK}`}>
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span>+91 93630 21195</span>
                  </a>
                  <a href="tel:9384800141" className={`flex items-center gap-2 text-theme-muted ${FOOTER_LINK}`}>
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span>+91 93848 00141</span>
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
                    href="https://maps.app.goo.gl/uDAuNfJjh5uXBpZa9"
                    target="_blank"
                    rel="noreferrer"
                    className={`flex items-start gap-2 ${FOOTER_LINK}`}
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>No. 6 &amp; 7, 3rd floor 5th Street, Dr. Radhakrishnan Salai, Mylapore, Chennai</span>
                  </a>
                </li>
              </ul>

              <div className="flex items-center gap-4 pt-1 text-theme-secondary">
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="WayTara on X"
                  title="X (Twitter)"
                  className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors p-0.5"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="WayTara on Instagram"
                  title="Instagram"
                  className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors p-0.5"
                >
                  <svg className="w-4 h-4 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24">
                    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                  </svg>
                </a>
                <a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="WayTara on LinkedIn"
                  title="LinkedIn"
                  className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors p-0.5"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
                  </svg>
                </a>
              </div>
            </div>

          </div>
        </div>

        {/* 2. Brand watermark with a vertical fade (theme adaptive, lowercase) */}
        <div
          className="my-1 sm:my-2 text-center select-none pointer-events-none overflow-hidden"
          style={{
            maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.16) 0%, rgba(0,0,0,0.04) 60%, rgba(0,0,0,0) 95%)",
            WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0.16) 0%, rgba(0,0,0,0.04) 60%, rgba(0,0,0,0) 95%)",
          }}
        >
          <span className="text-[17vw] font-black tracking-[-0.05em] text-theme-primary leading-none block lowercase">waytara</span>
        </div>

        {/* 3. Bottom bar: copyright and the policy pages */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-theme-muted">
          <p>© {new Date().getFullYear()} WayTara Energy LLP. All rights reserved.</p>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-theme-secondary">
            {LEGAL_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className={FOOTER_LINK}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>

      </div>
    </footer>
  );
}
