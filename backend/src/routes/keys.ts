import { Router, Request, Response } from "express";
import { createApiKey } from "../services/store";
import { apiError } from "../middleware/errors";
import { keyMintLimit } from "../middleware/rateLimit";

export const keysRouter = Router();

keysRouter.post("/", keyMintLimit, async (req: Request, res: Response) => {
  const label =
    typeof req.body?.label === "string" ? req.body.label.slice(0, 60) : "default";
  try {
    const { key, record } = await createApiKey(label);
    res.json({
      key,
      id: record.id,
      prefix: record.prefix,
      tier: record.tier,
      message: "Store this key now. It will not be shown again.",
    });
  } catch {
    apiError(res, 503, "capacity", "Key minting is temporarily unavailable.");
  }
});
