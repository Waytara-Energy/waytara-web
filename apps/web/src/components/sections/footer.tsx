import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { Mail, Phone, MapPin } from "lucide-react";
import { SITE } from "@/lib/site";
import { LEGAL_LINKS, PARTNER_LINK, PRIMARY_LINKS, CONTACT_LINK, SOLUTION_SEGMENTS } from "@/config/site-nav";

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

        {/* 1. Main row: brand and one line about what WayTara does, then three short columns */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 pb-10">

          <div className="lg:col-span-4 space-y-4">
            <Logo />
            <p className="text-sm sm:text-[15px] text-theme-primary leading-relaxed font-medium max-w-sm pt-1">
              WayTara designs, installs and manages solar, battery storage and EV charging as one connected energy system.
            </p>
          </div>

          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">

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

              <div className="flex items-center gap-4 pt-1 text-theme-secondary">
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
                  href={SITE.whatsapp}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="WayTara on WhatsApp Business"
                  title="WhatsApp Business"
                  className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors p-0.5"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
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
