import type { NextConfig } from "next";
import { securityHeaders } from "@waytara/config/security-headers";

const nextConfig: NextConfig = {
  // Don't advertise the framework in a response header.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders() }];
  },
};

export default nextConfig;
