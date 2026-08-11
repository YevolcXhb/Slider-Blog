import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  // Capture extra error data (e.g. non-Error property enumerations) that the
  // default serializer drops — useful for Prisma errors and 3rd-party SDKs.
  integrations: [Sentry.extraErrorDataIntegration()],
});
