import { Router, Request, Response } from "express";
import { searchProteins } from "../services/genbank";

export const searchRouter = Router();

searchRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== "string") {
      res.status(400).json({ error: "Missing 'query' in request body" });
      return;
    }

    const results = await searchProteins(query.split(" "));

    res.json({ query, results });
  } catch (error) {
    // Do not echo error.message: upstream axios errors can embed the GenBank
    // URL, which carries &api_key=<NCBI key>. Log server-side only.
    console.error("Search error:", error);
    res.status(500).json({ error: "Search failed." });
  }
});
