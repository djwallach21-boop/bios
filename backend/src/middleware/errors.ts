import { randomBytes } from "crypto";
import { Request, Response, NextFunction } from "express";

// Attach a request id to every response (BiOS-Request-Id header + res.locals)
// so callers and logs can correlate. The basis of a clean error envelope.
export function requestId(_req: Request, res: Response, next: NextFunction): void {
  const id = `req_${randomBytes(8).toString("base64url")}`;
  res.locals.requestId = id;
  res.setHeader("BiOS-Request-Id", id);
  next();
}

// Standard error envelope, Stripe-style, never leaking internal URLs/stacks.
export function apiError(
  res: Response,
  status: number,
  type: string,
  message: string
): void {
  res.status(status).json({
    error: { type, message, request_id: res.locals.requestId ?? null },
  });
}
