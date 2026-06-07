import type { NextConfig } from "next";

// Content-Security-Policy tuned for this app: Next injects inline bootstrap
// scripts (so script-src needs 'unsafe-inline'/'unsafe-eval'), Tailwind emits
// inline styles, 3Dmol renders WebGL (canvas/blob worker), and the browser
// calls a cross-origin HTTPS API. We still lock down the high-value vectors:
// no framing (frame-ancestors none), no plugins (object-src none), base-uri
// self, and connect limited to self + https.
// The browser calls the backend cross-origin; allow exactly that origin (read
// from the build-time API base) plus self -- tight in prod, and working for a
// local http backend during dev/testing.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";
let apiOrigin = "http://localhost:3001";
try {
  apiOrigin = new URL(API_BASE).origin;
} catch {
  /* keep fallback */
}

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  `connect-src 'self' ${apiOrigin}`,
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  // Hide the dev-only build-activity badge; it floats over the bottom-left of
  // the sidebar and pollutes design screenshots.
  devIndicators: false,
  // molstar ships scss skins + non-JS assets; run it through Next's full loader
  // pipeline (sass installed) and treat stray .html as raw source so it bundles.
  transpilePackages: ["molstar"],
  webpack: (config) => {
    config.module.rules.push({ test: /\.html$/i, type: "asset/source" });
    // molstar's app entry references Node-only modules (video export); stub them
    // for the browser bundle.
    config.resolve = config.resolve || {};
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      fs: false,
      path: false,
      crypto: false,
    };
    return config;
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
