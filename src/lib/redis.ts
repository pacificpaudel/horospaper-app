import { Redis } from "@upstash/redis";

// The Vercel Marketplace "Upstash for Redis" integration injects
// KV_REST_API_URL/TOKEN (legacy @vercel/kv-compatible names), not the
// UPSTASH_REDIS_REST_URL/TOKEN names Redis.fromEnv() looks for.
export const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

/** Everything in this app is scoped to a single day; nothing outlives this. */
export const TTL_SECONDS = 60 * 60 * 24;
