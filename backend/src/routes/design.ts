import { Router, Request, Response } from "express";
import { runDesign } from "../services/pipeline";
import { saveDesign } from "../services/store";

export const designRouter = Router();

designRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { intent, parentId } = req.body;

    if (!intent || typeof intent !== "string") {
      res.status(400).json({ error: "Missing 'intent' in request body" });
      return;
    }
    if (intent.length > 20000) {
      res.status(400).json({ error: "Request too long." });
      return;
    }

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
    // Log details server-side; never leak upstream URLs/stacks to clients.
    console.error("Design error:", error);
    res.status(500).json({
      error: { type: "internal_error", message: "Design failed." },
    });
  }
});
