import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// CSP pragmática: bloqueia scripts/iframes externos e clickjacking, mantendo
// compatibilidade com o Next (inline de hidratação) sem nonce. 'unsafe-eval'
// só em dev (algumas libs/HMR precisam). Imagens/CDNs e WebSocket liberados.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' ws: wss: https:",
  "media-src 'self' blob: data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const nextConfig: NextConfig = {
  transpilePackages: ["@pleno-crm/types"],
  images: {
    remotePatterns: [
      { hostname: "*.meucuidadoessencial.com.br" },
      { hostname: "*.cdninstagram.com" },
      { hostname: "*.fbcdn.net" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
