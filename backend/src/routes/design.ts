import { Router, Request, Response } from "express";
import { runDesign } from "../services/pipeline";
import { saveDesign } from "../services/store";
import { acquireSlot, OverloadError } from "../lib/limit";

export const designRouter = Router();

designRouter.post("/", async (req: Request, res: Response) => {
  const { intent, parentId } = req.body;

  if (!intent || typeof intent !== "string") {
    res.status(400).json({ error: "Missing 'intent' in request body" });
    return;
  }
  if (intent.length > 20000) {
    res.status(400).json({ error: "Request too long." });
    return;
  }

  let release: (() => void) | null = null;
  try {
    release = await acquireSlot();
    const result = await runDesign(intent);
    // Never persist a declined/flagged request.
    if (result.kind === "decline") {
      res.json(result);
      return;
    }
    const saved = saveDesign(
      result,
      Date.now(),
      typeof parentId === "string" ? parentId : null
    );
    res.json({ id: saved.id, ...result });
  } catch (error) {
    if (error instanceof OverloadError) {
      res.status(503).json({
        error: { type: "capacity", message: "Server at capacity. Retry shortly." },
      });
      return;
    }
    // Log message only (never the full error, which can carry upstream URLs /
    // the NCBI api_key); never leak it to clients.
    console.error("Design error:", error instanceof Error ? error.message : error);
    res.status(500).json({
      error: { type: "internal_error", message: "Design failed." },
    });
  } finally {
    release?.();
  }
});
