import { Router, Request, Response } from "express";
import { getDesign, listDesigns, type GallerySort } from "../services/store";

export const designsRouter = Router();

// Public gallery: recent | forked | top.
designsRouter.get("/", (req: Request, res: Response) => {
  const sortParam = String(req.query.sort ?? "recent");
  const sort: GallerySort = ["recent", "forked", "top"].includes(sortParam)
    ? (sortParam as GallerySort)
    : "recent";
  res.json({ sort, designs: listDesigns(sort) });
});

// A single shared design by permalink id, with its parent (lineage).
designsRouter.get("/:id", (req: Request, res: Response) => {
  const design = getDesign(String(req.params.id));
  if (!design) {
    res.status(404).json({ error: "Design not found" });
    return;
  }
  const parent = design.parentId ? getDesign(design.parentId) : null;
  res.json({
    ...design,
    parent: parent ? { id: parent.id, title: parent.title } : null,
  });
});
