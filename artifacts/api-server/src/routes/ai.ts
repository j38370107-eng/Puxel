/**
 * AI routes – generation is now handled entirely client-side via the
 * procedural pixelArtEngine. These routes are kept for backwards
 * compatibility but are no longer called by the frontend.
 */
import { Router } from "express";

const router = Router();

router.post("/generate-sprite", (_req, res) => {
  res.status(410).json({
    error: "Server-side AI generation has been replaced by the built-in procedural engine. Generation now runs entirely in the browser.",
  });
});

router.post("/enhance-image", (_req, res) => {
  res.status(410).json({
    error: "Server-side AI enhancement has been replaced by the built-in procedural engine. Enhancement now runs entirely in the browser.",
  });
});

export default router;
