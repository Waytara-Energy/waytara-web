import type { Metadata, Viewport } from "next";
import { Poppins, Outfit } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { JsonLd } from "@/components/seo/json-ld";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import { SITE } from "@/lib/site";

// Primary Brand Font: Poppins
const poppins = Poppins({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-poppins",
});

// Alternative Brand Font: Outfit (swappable with one line toggle). Outfit is
// a variable font — no `weight` array here (unlike Poppins above, which
// isn't variable and needs one): Turbopack's font resolver can't handle a
// discrete weight array against a variable font ("next/font/google queries
// have exactly one entry"), even though Webpack tolerated it. Every weight
// is still available via CSS `font-weight` against the variable axis.
const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-outfit",
});

// Active Brand Font variable configuration
const ACTIVE_BRAND_FONT = poppins; // To switch to Outfit, change to: outfit

export const metadata: Metadata = {
  // Resolves every relative canonical / Open Graph URL against the real domain.
  metadataBase: new URL(SITE.url),
  applicationName: SITE.name,
  title: {
    default: `WayTara | ${SITE.tagline}`,
    // Pages pass just their own title ("About Us"); this appends the brand.
    template: "%s | WayTara Energy",
  },
  description: SITE.description,
  keywords: [
    "Solar Energy",
    "Battery Energy Storage",
    "BESS",
    "EV Charging",
    "Home Independence",
    "Commercial Solar",
    "Clean Energy India",
    "WayTara",
  ],
  authors: [{ name: "WayTara Energy" }],
  openGraph: {
    title: "WayTara — Your Property's Energy, Designed as One Intelligent System",
    description:
      "Integrated rooftop solar, smart battery storage, and EV charging designed and installed under one accountable warranty.",
    type: "website",
    siteName: SITE.name,
    locale: SITE.locale,
    url: "/",
  },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0F0D" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${poppins.variable} ${outfit.variable}`}
    >
      <body
        className={`${ACTIVE_BRAND_FONT.className} min-h-screen bg-theme-bg text-theme-primary antialiased selection:bg-emerald-500 selection:text-white`}
        suppressHydrationWarning
      >
        {/* Site-wide entity data: who the organisation is and what the site is. */}
        <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={200}>
            {children}
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
