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
    // Cap length so a huge body can't build a multi-MB NCBI URL.
    if (query.length > 500) {
      res.status(400).json({ error: "Query too long." });
      return;
    }

    const results = await searchProteins(query.split(" "));

    res.json({ query, results });
  } catch (error) {
    // Do not echo error.message: upstream axios errors can embed the GenBank
    // URL, which carries &api_key=<NCBI key>. Log the message only (never the
    // full error object, whose config.url/params hold the key) server-side.
    console.error("Search error:", error instanceof Error ? error.message : error);
    res.status(500).json({ error: "Search failed." });
  }
});
