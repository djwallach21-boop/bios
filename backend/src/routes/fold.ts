import { Router, Request, Response } from "express";
import { foldSequence } from "../services/esmfold";
import { acquireSlot, OverloadError } from "../lib/limit";

export const foldRouter = Router();

// Fold a single sequence on demand (used for non-default candidates and for
// rendering structures lazily). Goes through the shared concurrency limiter so
// a burst of folds can't fan out unbounded connections to the public ESMFold
// endpoint (which would get us rate-limited/banned there).
foldRouter.post("/", async (req: Request, res: Response) => {
  const { sequence } = req.body;
  if (!sequence || typeof sequence !== "string") {
    res.status(400).json({ error: "Missing 'sequence' in request body" });
    return;
  }
  // ESMFold caps at ~400 residues; reject obviously oversized input up front
  // rather than silently truncating a multi-KB string.
  if (sequence.length > 8000) {
    res.status(400).json({ error: "Sequence too long." });
    return;
  }

  let release: (() => void) | null = null;
  try {
    release = await acquireSlot();
    const fold = await foldSequence(sequence);
    if (!fold) {
      res.status(422).json({ error: "Could not fold this sequence" });
      return;
    }
    res.json({ pdb: fold.pdb, confidence: fold.meanPlddt, folded: fold.folded });
  } catch (error) {
    if (error instanceof OverloadError) {
      res.status(503).json({ error: "Server at capacity. Retry shortly." });
      return;
    }
    // Log the message only (never the full error object, which can carry
    // upstream URLs); do not echo it to callers.
    console.error("Fold error:", error instanceof Error ? error.message : error);
    res.status(500).json({ error: "Fold failed." });
  } finally {
    release?.();
  }
});
