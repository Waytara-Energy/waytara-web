// Shared HTTP security headers for both Next apps (imported from each
// next.config.ts). Plain ESM so Next can load it without transpiling the
// workspace package.
//
// CSP note: Next injects small inline bootstrap scripts, so `script-src`
// needs 'unsafe-inline' unless every page is rendered per-request with a
// nonce (which would make marketing pages dynamic and slower). Everything
// else is locked down hard: no third-party script/connect hosts, no framing,
// no <object>, no base-tag hijacking, forms only to self.

/**
 * @param {object} [options]
 * @param {string[]} [options.scriptSrc]   extra script origins (analytics, etc.)
 * @param {string[]} [options.connectSrc]  extra fetch/XHR/WebSocket origins
 * @param {string[]} [options.imgSrc]      extra image origins
 * @returns {{ key: string, value: string }[]}
 */
export function securityHeaders(options = {}) {
  const isDev = process.env.NODE_ENV !== "production";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseHttp = supabaseUrl ? new URL(supabaseUrl).origin : "";
  const supabaseWs = supabaseHttp.replace(/^http/, "ws");
  // Error reports go to the DSN's ingest host; allow exactly that origin, and only when configured.
  const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  const sentryOrigin = sentryDsn ? new URL(sentryDsn).origin : "";

  const csp = [
    "default-src 'self'",
    // 'unsafe-eval' only in dev (React refresh / source maps need it).
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval' https://va.vercel-scripts.com" : ""} ${(options.scriptSrc ?? []).join(" ")}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabaseHttp} ${(options.imgSrc ?? []).join(" ")}`.trim(),
    "media-src 'self'",
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseHttp} ${supabaseWs} ${sentryOrigin} ${(options.connectSrc ?? []).join(" ")}`.replace(/\s+/g, " ").trim(),
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  return [
    { key: "Content-Security-Policy", value: csp },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=(), usb=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "X-DNS-Prefetch-Control", value: "on" },
  ];
}
