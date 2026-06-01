import { Request, Response, NextFunction } from "express";
import { validateApiKey } from "../services/store";
import { apiError } from "./errors";

// Optional API-key auth. A valid `Authorization: Bearer bios_sk_...` resolves
// the caller's tier; no header falls through to an anonymous tier so the
// 60-second quickstart needs no signup. Never logs the Authorization header.
export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    const record = validateApiKey(header.slice(7).trim());
    if (!record) {
      apiError(res, 401, "authentication_error", "Invalid API key.");
      return;
    }
    res.locals.bios = { tier: record.tier, keyId: record.id };
  } else {
    res.locals.bios = { tier: "anonymous", keyId: null };
  }
  next();
}
