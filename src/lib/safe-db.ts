import * as Sentry from "@sentry/nextjs";

type AsyncFn<T> = () => Promise<T>;

export async function safeDbQuery<T>(fn: AsyncFn<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    // Report to Sentry, but preserve the existing fallback behavior so
    // end-user-facing requests still degrade gracefully.
    try {
      Sentry.captureException(error);
    } catch {
      // Sentry may be unavailable (e.g. DSN not configured) — never let
      // telemetry failure mask the original error.
    }
    return fallback;
  }
}
