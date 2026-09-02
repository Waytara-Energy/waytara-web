"use client";

import * as React from "react";
import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { Mail, Phone, MapPin, ShieldCheck } from "lucide-react";

export function Footer() {
  const handleAnchorClick = (
    href: string,
    e: React.MouseEvent<HTMLAnchorElement>
  ) => {
    if (href.startsWith("/#") && typeof window !== "undefined") {
      const targetId = href.replace("/#", "");
      const elem = document.getElementById(targetId);
      if (elem) {
        e.preventDefault();
        elem.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  return (
    <footer className="border-t border-black/[0.06] dark:border-white/[0.06] bg-theme-bg text-theme-secondary text-xs relative overflow-hidden">
      <div className="fluid-container pt-12 pb-8 relative z-10">
        
        {/* 1. Main Row: Left Brand/Mission + Right 4 Navigation Columns (Solutions, Explore, Help, Legal) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 pb-10">
          
          {/* Left Column: Logo + Mission Statement + Certification Badge */}
          <div className="lg:col-span-4 space-y-4">
            <Logo />
            
            <p className="text-sm sm:text-[15px] text-theme-primary leading-relaxed font-medium max-w-sm pt-1">
              WayTara engineers and deploys high-performance integrated solar rooftop arrays, Smart LFP battery storage, and dynamic EV charging ecosystems under one single accountable warranty.
            </p>
            
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 pt-1">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>MNRE Registered &bull; IEC Certified Hardware &bull; Tier-1 Quality</span>
            </div>
          </div>

          {/* Right Columns: 4 Navigation Columns (Solutions, Explore, Help, Legal) */}
          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
            
            {/* Column 1: Solutions */}
            <div className="space-y-3">
              <h4 className="text-xs sm:text-[13px] font-bold text-theme-primary tracking-tight">
                Solutions
              </h4>
              <ul className="space-y-2.5 text-xs text-theme-secondary">
                <li>
                  <Link href="/solutions/home" className="hover:text-theme-primary transition-colors">
                    Homes &amp; Villas
                  </Link>
                </li>
                <li>
                  <Link href="/solutions/apartment" className="hover:text-theme-primary transition-colors">
                    Apartments &amp; Societies
                  </Link>
                </li>
                <li>
                  <Link href="/solutions/factory" className="hover:text-theme-primary transition-colors">
                    Industrial &amp; Factories
                  </Link>
                </li>
                <li>
                  <Link href="/solutions/commercial" className="hover:text-theme-primary transition-colors">
                    Commercial &amp; Offices
                  </Link>
                </li>
                <li>
                  <Link href="/solutions/ev-fleet" className="hover:text-theme-primary transition-colors">
                    EV Infrastructure
                  </Link>
                </li>
                <li>
                  <Link href="/solutions/it-park" className="hover:text-theme-primary transition-colors">
                    IT Parks &amp; Data Centers
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 2: Explore */}
            <div className="space-y-3">
              <h4 className="text-xs sm:text-[13px] font-bold text-theme-primary tracking-tight">
                Explore
              </h4>
              <ul className="space-y-2.5 text-xs text-theme-secondary">
                <li>
                  <Link
                    href="/#who-we-are"
                    onClick={(e) => handleAnchorClick("/#who-we-are", e)}
                    className="hover:text-theme-primary transition-colors"
                  >
                    Who We Are
                  </Link>
                </li>
                <li>
                  <Link
                    href="/#how-it-works"
                    onClick={(e) => handleAnchorClick("/#how-it-works", e)}
                    className="hover:text-theme-primary transition-colors"
                  >
                    How It Works
                  </Link>
                </li>
                <li>
                  <Link
                    href="/#why-integrated"
                    onClick={(e) => handleAnchorClick("/#why-integrated", e)}
                    className="hover:text-theme-primary transition-colors"
                  >
                    Why WayTara
                  </Link>
                </li>
                <li>
                  <Link
                    href="/#energy-planner"
                    onClick={(e) => handleAnchorClick("/#energy-planner", e)}
                    className="hover:text-theme-primary transition-colors"
                  >
                    Plan with Tara AI
                  </Link>
                </li>
                <li>
                  <Link href="/knowledge-centre" className="hover:text-theme-primary transition-colors">
                    Knowledge Centre
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 3: Help */}
            <div className="space-y-3">
              <h4 className="text-xs sm:text-[13px] font-bold text-theme-primary tracking-tight">
                Help
              </h4>
              <ul className="space-y-2.5 text-xs text-theme-secondary">
                <li>
                  <Link
                    href="/#faq"
                    onClick={(e) => handleAnchorClick("/#faq", e)}
                    className="hover:text-theme-primary transition-colors"
                  >
                    FAQs
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-theme-primary transition-colors">
                    Contact Us
                  </Link>
                </li>
                <li>
                  <Link href="/knowledge-centre" className="hover:text-theme-primary transition-colors">
                    Help Centre
                  </Link>
                </li>
                <li>
                  <Link href="/about" className="hover:text-theme-primary transition-colors">
                    About Us
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 4: Legal */}
            <div className="space-y-3">
              <h4 className="text-xs sm:text-[13px] font-bold text-theme-primary tracking-tight">
                Legal
              </h4>
              <ul className="space-y-2.5 text-xs text-theme-secondary">
                <li>
                  <Link href="/terms" className="hover:text-theme-primary transition-colors">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-theme-primary transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/cookies" className="hover:text-theme-primary transition-colors">
                    Cookie Policy
                  </Link>
                </li>
                <li>
                  <Link href="/warranty" className="hover:text-theme-primary transition-colors">
                    Warranty Policy
                  </Link>
                </li>
              </ul>
            </div>

          </div>

        </div>

        {/* 2. Massive Brand Watermark with Vertical Fade Gradient (Theme Adaptive Lowercase) */}
        <div
          className="my-1 sm:my-2 text-center select-none pointer-events-none overflow-hidden"
          style={{
            maskImage:
              "linear-gradient(to bottom, rgba(0,0,0,0.16) 0%, rgba(0,0,0,0.04) 60%, rgba(0,0,0,0) 95%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, rgba(0,0,0,0.16) 0%, rgba(0,0,0,0.04) 60%, rgba(0,0,0,0) 95%)",
          }}
        >
          <span className="text-[17vw] font-black tracking-[-0.05em] text-theme-primary leading-none block lowercase">waytara</span>
        </div>

        {/* 3. Bottom Legal Bar with Plain Lone Icons at the End */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-theme-muted">
          <p>© {new Date().getFullYear()} WayTara Energy LLP. All rights reserved.</p>

          {/* Lone Filled Icons without Border or Background */}
          <div className="flex items-center gap-4 text-theme-secondary">
            
            {/* Phone */}
            <a
              href="tel:9384800141"
              aria-label="Call WayTara"
              title="+91 93848 00141"
              className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors p-0.5"
            >
              <Phone className="w-4 h-4" />
            </a>

            {/* Email */}
            <a
              href="mailto:contactus@waytaraenergy.com"
              aria-label="Email WayTara"
              title="contactus@waytaraenergy.com"
              className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors p-0.5"
            >
              <Mail className="w-4 h-4" />
            </a>

            {/* Location / Google Maps */}
            <a
              href="https://maps.app.goo.gl/uDAuNfJjh5uXBpZa9"
              target="_blank"
              rel="noreferrer"
              aria-label="WayTara Registered Office"
              title="No. 6 & 7, 3rd floor 5th Street, Dr. Radhakrishnan Salai, Mylapore, Chennai"
              className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors p-0.5"
            >
              <MapPin className="w-4 h-4" />
            </a>

            {/* X / Twitter */}
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

            {/* Instagram */}
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

            {/* LinkedIn */}
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
    </footer>
  );
}
