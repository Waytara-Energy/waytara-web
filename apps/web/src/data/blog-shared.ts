import type { GuideCta } from "./guides";

// Shared by the blog's article files: the date of the last check and the two calls to action.

export const UPDATED = "2026-11-16";
export const UPDATED_LABEL = "16 November 2026";

export const PARTNER_CTA: GuideCta = {
  primary: { label: "Apply to partner", href: "/partner#apply" },
  secondary: { label: "See the Partner Network", href: "/partner" },
  closing: {
    heading: "Want to work",
    accent: "with WayTara?",
    a: { label: "Apply to partner", href: "/partner#apply", hint: "A short form. No documents are needed at this stage." },
    b: { label: "Read the partner page", href: "/partner", hint: "Who we work with, how it works and what we promise." },
  },
};

export const PLATFORM_CTA: GuideCta = {
  primary: { label: "Check my equipment", href: "/technology#compatibility" },
  secondary: { label: "Talk to us", href: "/contact" },
  closing: {
    heading: "Does your equipment",
    accent: "connect?",
    a: { label: "Check my equipment", href: "/technology#compatibility", hint: "Tell us the make and model. You do not need to replace anything to ask." },
    b: { label: "Talk to an engineer", href: "/contact", hint: "Ask about your site, your inverter or your charger. There is no commitment either way." },
  },
};
