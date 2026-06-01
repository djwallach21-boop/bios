import { Router, Request, Response } from "express";
import { createApiKey } from "../services/store";

export const keysRouter = Router();

// Mint a new API key. The plaintext key is returned once and never stored.
keysRouter.post("/", (req: Request, res: Response) => {
  const label =
    typeof req.body?.label === "string" ? req.body.label.slice(0, 60) : "default";
  const { key, record } = createApiKey(label);
  res.json({
    key,
    id: record.id,
    prefix: record.prefix,
    tier: record.tier,
    message: "Store this key now. It will not be shown again.",
  });
});
