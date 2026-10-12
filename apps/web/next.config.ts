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
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders({ connectSrc: MAP_HOST, imgSrc: MAP_HOST, workerSrc: ["blob:"] }) }];
  },
};

export default nextConfig;
