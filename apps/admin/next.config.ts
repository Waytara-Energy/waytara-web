import type { NextConfig } from "next";
import { securityHeaders } from "@waytara/config/security-headers";

const nextConfig: NextConfig = {
  // E2E tests run their own dev servers in a separate directory so they never
  // collide with (or kill) a developer's running `next dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Don't advertise the framework in a response header.
  poweredByHeader: false,
  // A purchase order is uploaded through a form action (up to 15 MB, see lib/po-document.ts); the default limit for an action's request is 1 MB.
  experimental: { serverActions: { bodySizeLimit: "16mb" } },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders() }];
  },
};

export default nextConfig;
