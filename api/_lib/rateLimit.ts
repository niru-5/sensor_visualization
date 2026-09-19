/**
 * Minimal in-memory rate limiter. NOT production-grade: serverless
 * functions can run as multiple cold-started instances that don't share
 * this Map, so it only throttles a single warm instance. Good enough as a
 * cheap guard against accidental loops on a single-user side project; if
 * this ever needs to be reliable across instances, move it to a shared
 * store (e.g. Redis/Upstash) instead of scaling this up.
 */
const WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = 10

const hits = new Map<string, number[]>()

export function isRateLimited(key: string): boolean {
  const now = Date.now()
  const timestamps = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  timestamps.push(now)
  hits.set(key, timestamps)
  return timestamps.length > MAX_REQUESTS_PER_WINDOW
}
