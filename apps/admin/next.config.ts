import type { NextConfig } from "next";
import { securityHeaders } from "@waytara/config/security-headers";

const nextConfig: NextConfig = {
  // E2E tests run their own dev servers in a separate directory so they never
  // collide with (or kill) a developer's running `next dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Don't advertise the framework in a response header.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders() }];
  },
};

export default nextConfig;
