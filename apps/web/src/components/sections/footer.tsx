import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { Mail, MessageCircle, Phone, MapPin } from "lucide-react";
import { SITE } from "@/lib/site";
import { LEGAL_LINKS, PARTNER_LINK, PRIMARY_LINKS, CONTACT_LINK, SOLUTION_SEGMENTS, GUIDE_LINKS } from "@/config/site-nav";

type FooterLink = { label: string; href: string };

const COMPANY_LINKS: FooterLink[] = [...PRIMARY_LINKS, PARTNER_LINK, { label: "Support", href: "/support" }, CONTACT_LINK, { label: "Customer sign in", href: "/login" }];

const COLUMN_TITLE = "text-xs sm:text-[13px] font-bold text-theme-primary tracking-tight";
const FOOTER_LINK = "hover:text-theme-primary transition-colors";

function LinkColumn({ title, links }: { title: string; links: readonly FooterLink[] }) {
  return (
    <div className="space-y-3">
      <h4 className={COLUMN_TITLE}>{title}</h4>
      <ul className="space-y-2.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={FOOTER_LINK}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-black/[0.06] dark:border-white/[0.06] bg-theme-bg text-theme-secondary text-xs relative overflow-hidden">
      <div className="fluid-container pt-12 pb-8 relative z-10">

        {/* 1. The brand and its copyright line on the left, the link columns on the right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 pb-10">

          <div className="lg:col-span-4 space-y-4">
            <Logo />
            <p className="text-xs text-theme-muted pt-1">© {new Date().getFullYear()} WayTara Energy LLP. All rights reserved.</p>
          </div>

          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-[1fr_1.1fr_1fr_0.9fr_1.6fr] gap-6 sm:gap-8 xl:gap-6">
            <LinkColumn title="Solutions" links={SOLUTION_SEGMENTS} />
            <LinkColumn title="Guides" links={GUIDE_LINKS} />
            <LinkColumn title="Company" links={COMPANY_LINKS} />
            <LinkColumn title="Legal" links={LEGAL_LINKS} />

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
