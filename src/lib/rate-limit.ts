import { RateLimiterMemory } from "rate-limiter-flexible";

// 10 requests per second for general API routes
const apiLimiter = new RateLimiterMemory({
  points: 10,
  duration: 1,
  blockDuration: 1,
});

// 1 request per second for comment submissions
const commentLimiter = new RateLimiterMemory({
  points: 1,
  duration: 1,
  blockDuration: 5,
});

// 5 requests per minute for auth (login) to prevent brute-force attacks
const authLimiter = new RateLimiterMemory({
  points: 5,
  duration: 60,
});

export async function rateLimit(
  key: string,
  type: "api" | "comment" | "auth" = "api",
): Promise<void> {
  const limiter =
    type === "api" ? apiLimiter : type === "comment" ? commentLimiter : authLimiter;

  // consume() throws a RateLimiterRes object (not an Error) when the limit is exceeded
  try {
    await limiter.consume(key);
  } catch {
    throw new Error("Rate limit exceeded");
  }
}
