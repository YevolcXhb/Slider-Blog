import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  // Explicitly enable browser tracing so that Web Vitals (LCP/CLS/INP/FCP/TTFB)
  // and route-change transactions are captured. The Next.js SDK injects this by
  // default, but declaring it explicitly keeps the intent visible.
  integrations: [Sentry.browserTracingIntegration()],
  // Strip personally-identifiable information from URLs before sending to Sentry.
  sendDefaultPii: false,
  beforeSend(event) {
    // Drop client-side errors that are noisy and not actionable.
    if (event.exception?.values?.[0]?.value) {
      const msg = event.exception.values[0].value;
      // ResizeObserver loop errors are benign browser noise.
      if (msg.includes("ResizeObserver loop")) {
        return null;
      }
    }
    return event;
  },
});
