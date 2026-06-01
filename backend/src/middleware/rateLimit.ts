import { Request, Response, NextFunction } from "express";
import { apiError } from "./errors";

// In-memory token-bucket rate limiter keyed on the resolved principal
// (api key id, else client IP). Per-route cost weights protect the paid
// upstreams (Claude / NVIDIA NIM) from denial-of-wallet. For multi-instance
// this moves to Redis; single-instance in-memory is correct for launch.

interface Bucket {
  tokens: number;
  updated: number;
}

const TIER_CAPACITY: Record<string, number> = {
  anonymous: 40, // generous enough for the 60s quickstart
  free: 200,
  dev: 2000,
  scale: 20000,
};
const REFILL_PER_SEC = 0.05; // ~1 token / 20s sustained; bursts up to capacity

const buckets = new Map<string, Bucket>();

// Cost weights: reads are cheap, billed-compute is expensive.
function costFor(path: string, method: string): number {
  if (method === "GET") return 1;
  if (/\/designs?(\/|$)/.test(path)) return 10; // Claude + NIM + ESMFold (/v1/designs* and /api/design[/stream])
  if (path.includes("/fold")) return 4; // ESMFold
  if (path.includes("/search")) return 2;
  if (path.includes("/keys")) return 5;
  return 1;
}

export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const ctx = res.locals.bios ?? { tier: "anonymous", keyId: null };
  const principal = ctx.keyId ?? `ip:${req.ip}`;
  const capacity = TIER_CAPACITY[ctx.tier] ?? TIER_CAPACITY.anonymous;

  const now = Date.now();
  let b = buckets.get(principal);
  if (!b) {
    b = { tokens: capacity, updated: now };
    buckets.set(principal, b);
  }
  // Refill.
  b.tokens = Math.min(capacity, b.tokens + ((now - b.updated) / 1000) * capacity * REFILL_PER_SEC);
  b.updated = now;

  // req.originalUrl is never mount-stripped; req.path collapses to "/" for
  // path-mounted /api/* routes, which would charge the heavy pipeline cost 1.
  const cost = costFor(req.originalUrl, req.method);
  res.setHeader("RateLimit-Limit", String(capacity));

  if (b.tokens < cost) {
    const retry = Math.ceil((cost - b.tokens) / (capacity * REFILL_PER_SEC));
    res.setHeader("RateLimit-Remaining", "0");
    res.setHeader("Retry-After", String(retry));
    apiError(
      res,
      429,
      "rate_limit_exceeded",
      `Rate limit exceeded. Retry in ~${retry}s, or use an API key for a higher tier.`
    );
    return;
  }

  b.tokens -= cost;
  res.setHeader("RateLimit-Remaining", String(Math.floor(b.tokens)));
  next();
}

// Periodically evict idle buckets so the map cannot grow unbounded.
setInterval(
  () => {
    const cutoff = Date.now() - 60 * 60 * 1000;
    for (const [k, v] of buckets) if (v.updated < cutoff) buckets.delete(k);
  },
  10 * 60 * 1000
).unref?.();
