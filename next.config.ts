import type { NextConfig } from "next";

// Content-Security-Policy tuned to what the app actually loads:
//  - worker-src blob:        mapbox-gl builds its web worker from a Blob URL
//  - img-src 'self' https:   gym.photo_url points at many third-party CDNs (seed
//                            data); data:/blob: for Twemoji data-URI icons +
//                            canvas image previews
//  - connect-src             Supabase (REST/auth/storage/functions + realtime ws)
//                            and the Mapbox API/tile/event hosts
//  - script/style 'unsafe-inline'  Next injects inline bootstrap + GymJsonLd uses
//                            an inline <script type=ld+json>. Dropping this needs
//                            per-request nonces, which require middleware — but the
//                            proxy middleware does NOT register in the prod build
//                            (verified: empty middleware-manifest), so a nonce
//                            pipeline isn't available without an architectural change
//                            (e.g. a Netlify Edge Function). Tracked as a follow-up.
//  - 'unsafe-eval'           only Next dev tooling (HMR/React refresh) needs it;
//                            mapbox-gl v3 ships no dynamic-code evaluation (verified)
//                            and prod Next needs none, so it is dropped in production
//                            and kept only in dev.
// The hard wins here are frame-ancestors/object-src/base-uri/form-action.
const isDev = process.env.NODE_ENV !== "production";
const scriptSrc = ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])].join(" ");
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' https: data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src ${scriptSrc}`,
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com https://*.mapbox.com",
  "manifest-src 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // microphone=self for the owner-form dictation; geolocation=self for any
  // "near me" use; camera unused.
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(self)" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
