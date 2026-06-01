import { Router, Request, Response } from "express";
import { foldSequence } from "../services/esmfold";

export const foldRouter = Router();

// Fold a single sequence on demand (used for non-default candidates and for
// rendering structures lazily).
foldRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { sequence } = req.body;
    if (!sequence || typeof sequence !== "string") {
      res.status(400).json({ error: "Missing 'sequence' in request body" });
      return;
    }

    const fold = await foldSequence(sequence);
    if (!fold) {
      res.status(422).json({ error: "Could not fold this sequence" });
      return;
    }

    res.json({ pdb: fold.pdb, confidence: fold.meanPlddt, folded: fold.folded });
  } catch (error) {
    // Log the message only (never the full error object, which can carry
    // upstream URLs); do not echo it to callers.
    console.error("Fold error:", error instanceof Error ? error.message : error);
    res.status(500).json({ error: "Fold failed." });
  }
});
