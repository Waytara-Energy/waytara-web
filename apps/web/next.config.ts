import type { NextConfig } from "next";
import { securityHeaders } from "@waytara/config/security-headers";

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
    return [{ source: "/:path*", headers: securityHeaders() }];
  },
};

export default nextConfig;
