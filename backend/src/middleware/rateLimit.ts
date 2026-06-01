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

// Aggregate ceiling on billed design spend across ALL principals. Per-principal
// buckets cannot bound total spend (an attacker can mint unlimited free keys,
// each getting its own bucket -- denial-of-wallet). This single shared bucket
// is the hard cap: once drained, design calls 429 for everyone until it
// refills, no matter how many keys/IPs exist. Sized for launch traffic; raise
// via env as real usage grows. Pair with provider-side spend caps.
const GLOBAL_CAPACITY = Number(process.env.BIOS_GLOBAL_DESIGN_CAPACITY ?? 300);
const globalBucket: Bucket = { tokens: GLOBAL_CAPACITY, updated: Date.now() };

function isDesignRequest(originalUrl: string, method: string): boolean {
  return method !== "GET" && /\/designs?(\/|$)/.test(originalUrl);
}

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

  // Billed design calls also draw on the global ceiling. Check it BEFORE
  // spending the per-principal tokens so a global-limit rejection doesn't
  // consume the caller's quota.
  if (isDesignRequest(req.originalUrl, req.method)) {
    globalBucket.tokens = Math.min(
      GLOBAL_CAPACITY,
      globalBucket.tokens +
        ((now - globalBucket.updated) / 1000) * GLOBAL_CAPACITY * REFILL_PER_SEC
    );
    globalBucket.updated = now;
    if (globalBucket.tokens < cost) {
      const retry = Math.ceil(
        (cost - globalBucket.tokens) / (GLOBAL_CAPACITY * REFILL_PER_SEC)
      );
      res.setHeader("Retry-After", String(retry));
      apiError(
        res,
        429,
        "rate_limit_exceeded",
        `Service is at its global design capacity. Retry in ~${retry}s.`
      );
      return;
    }
    globalBucket.tokens -= cost;
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
