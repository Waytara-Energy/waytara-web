import type { NextConfig } from "next";
import { securityHeaders } from "@waytara/config/security-headers";

// The Site tab's map loads its style, vector tiles, fonts and sprites from OpenFreeMap; the page may connect to and load images from it.
const MAP_HOST = ["https://tiles.openfreemap.org"];

const nextConfig: NextConfig = {
  // E2E tests run their own dev servers in a separate directory so they never
  // collide with (or kill) a developer's running `next dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Don't advertise the framework in a response header.
  poweredByHeader: false,
  images: {
    // Serve AVIF where supported, WebP otherwise; cache optimised variants for a month.
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  // The Knowledge Centre page has been removed: anyone with an old link lands on Support. Two guides lost the place name from their address (they cover every state and city): the old links go to the new ones.
  // The five solar guides now live under /blog like every other article, and the separate Guides page is gone (the blog lists them): the old addresses go to the new ones, in one step.
  async redirects() {
    return [
      { source: "/knowledge-centre", destination: "/support", permanent: true },
      { source: "/guides", destination: "/blog", permanent: true },
      { source: "/solar-for-home-chennai", destination: "/blog/solar-for-home", permanent: true },
      { source: "/solar-subsidy-tamil-nadu", destination: "/blog/solar-subsidy", permanent: true },
      { source: "/solar-for-home", destination: "/blog/solar-for-home", permanent: true },
      { source: "/on-grid-hybrid-off-grid-solar", destination: "/blog/on-grid-hybrid-off-grid-solar", permanent: true },
      { source: "/solar-subsidy", destination: "/blog/solar-subsidy", permanent: true },
      { source: "/pm-surya-ghar-muft-bijli-yojana", destination: "/blog/pm-surya-ghar-muft-bijli-yojana", permanent: true },
      { source: "/reduce-electricity-bill-solar", destination: "/blog/reduce-electricity-bill-solar", permanent: true },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders({ connectSrc: MAP_HOST, imgSrc: MAP_HOST, workerSrc: ["blob:"] }) }];
  },
};

export default nextConfig;
