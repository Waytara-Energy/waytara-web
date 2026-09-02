import type { Metadata, Viewport } from "next";
import { Poppins, Outfit } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

// Primary Brand Font: Poppins
const poppins = Poppins({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-poppins",
});

// Alternative Brand Font: Outfit (swappable with one line toggle)
const outfit = Outfit({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-outfit",
});

// Active Brand Font variable configuration
const ACTIVE_BRAND_FONT = poppins; // To switch to Outfit, change to: outfit

export const metadata: Metadata = {
  title: "WayTara | Intelligent Clean Energy Systems for Home, Business & Fleet",
  description:
    "Solar. Battery Storage. EV Charging. Monitoring — designed around your needs, installed under one trusted partner.",
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
  },
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
      >
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
