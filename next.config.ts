import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  output: "standalone",
  compress: false, // Nginx handles compression in production
  poweredByHeader: false,
  // 开发模式允许从以下来源访问 HMR 等 dev 资源（局域网 IP 与线上域名），
  // 否则浏览器会收到 "Blocked cross-origin request" 警告并导致 HMR 失效。
  allowedDevOrigins: ["192.168.3.21", "localhost", "www.slidercore.com", "slidercore.com"],
  // 客户端路由缓存：动态页面切走 30s 内再切回，命中缓存，零等待
  // 静态页面 5 分钟内切回命中缓存
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
    // 优化大型包的按需导入，减少客户端 bundle 体积
    optimizePackageImports: ["motion", "lucide-react"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 86400,
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "4000" },
      { protocol: "https", hostname: "**" }, // Allow production domains
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            // HSTS only takes effect over HTTPS — relies on a TLS-terminating
            // proxy (e.g. Nginx) in production. Over plain HTTP the browser
            // ignores this header, so dev (http://localhost:4000) is unaffected.
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  // Sentry 10+ replaced top-level `disableLogger` with
  // `webpack.treeshake.removeDebugLogging`. This project builds with
  // Turbopack, where the option is a no-op (debug logging is already
  // stripped by Turbopack's own tree-shaking), but the option is kept
  // here so that:
  //   1. The deprecated `disableLogger` warning is no longer emitted.
  //   2. If the project ever switches back to webpack, the option takes
  //      effect immediately without further config changes.
  webpack: {
    treeshake: { removeDebugLogging: true },
  },
});
