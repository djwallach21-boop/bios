import { Router, Request, Response } from "express";
import { saveFeedback } from "../services/store";

export const feedbackRouter = Router();

const RATINGS = new Set(["yes", "not_quite", "no"]);

// Capture an in-product reaction to a design. Deliberately tiny: a rating plus
// an optional note. This is the primary signal for what to build next.
feedbackRouter.post("/", (req: Request, res: Response) => {
  const { rating, text, designId } = req.body;
  if (typeof rating !== "string" || !RATINGS.has(rating)) {
    res
      .status(400)
      .json({ error: "rating must be one of: yes, not_quite, no" });
    return;
  }
  const cleanText = typeof text === "string" ? text.slice(0, 1000) : "";
  const cleanDesignId =
    typeof designId === "string" && designId.length <= 64 ? designId : null;
  try {
    // Safe cast: validated against RATINGS above (Set.has doesn't narrow the type).
    const record = saveFeedback(
      rating as "yes" | "not_quite" | "no",
      cleanText,
      cleanDesignId,
      Date.now()
    );
    res.json({ ok: true, id: record.id });
  } catch (error) {
    console.error(
      "feedback error:",
      error instanceof Error ? error.message : error
    );
    res.status(500).json({ error: "Could not save feedback." });
  }
});
