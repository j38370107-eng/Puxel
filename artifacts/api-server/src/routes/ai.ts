import { Router } from "express";
import OpenAI from "openai";
import { logger } from "../lib/logger";

const router = Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const STYLE_PROMPTS: Record<string, string> = {
  blasphemous:
    "Blasphemous video game pixel art style, dark gothic, intricate details, dramatic shading, atmospheric horror and religious iconography, high contrast, limited palette, crisp pixel-perfect edges",
  retro8bit:
    "classic NES 8-bit pixel art style, very limited 4-color palette per sprite, chunky pixels, retro game aesthetic",
  "16bit":
    "SNES 16-bit pixel art style, rich colors, detailed sprites, classic RPG aesthetic, Super Nintendo era",
  isometric:
    "isometric pixel art style, 2:1 angle, clean geometric shapes, game-ready asset",
  gothic:
    "dark gothic pixel art, black and purple palette, ornate details, horror aesthetic, atmospheric lighting",
  cyberpunk:
    "cyberpunk pixel art, neon colors on dark background, futuristic aesthetic, glowing effects",
};

function buildPrompt(
  userPrompt: string,
  style: string,
  width: number,
  height: number,
  frameIndex?: number,
  totalFrames?: number
): string {
  const styleDesc = STYLE_PROMPTS[style] ?? STYLE_PROMPTS.blasphemous;
  const sizeHint =
    width <= 16
      ? "very small 16x16 sprite"
      : width <= 32
        ? "32x32 sprite"
        : width <= 64
          ? "64x64 sprite"
          : "large sprite sheet";

  let frameHint = "";
  if (totalFrames && totalFrames > 1) {
    const phase =
      frameIndex === 0
        ? "idle stance frame"
        : frameIndex === 1
          ? "mid-action frame"
          : frameIndex === 2
            ? "peak-action frame"
            : "recovery frame";
    frameHint = `, animation frame ${(frameIndex ?? 0) + 1} of ${totalFrames} (${phase})`;
  }

  return (
    `${styleDesc}, ${sizeHint}${frameHint}, transparent background, ` +
    `centered composition, game-ready sprite. Subject: ${userPrompt}. ` +
    `The image should look like a high-quality pixel art asset suitable for a dark fantasy game. ` +
    `Use strong silhouette, deliberate pixel placement, clear readable form at small sizes.`
  );
}

// POST /ai/generate-sprite
router.post("/generate-sprite", async (req, res) => {
  try {
    const {
      prompt,
      style = "blasphemous",
      width = 32,
      height = 32,
      frameCount = 1,
    } = req.body as {
      prompt: string;
      style?: string;
      width?: number;
      height?: number;
      frameCount?: number;
    };

    if (!prompt || typeof prompt !== "string") {
      res.status(400).json({ error: "prompt is required" });
      return;
    }

    const clampedFrames = Math.min(Math.max(1, frameCount), 8);
    const frames: string[] = [];

    for (let i = 0; i < clampedFrames; i++) {
      const enhancedPrompt = buildPrompt(
        prompt,
        style,
        width,
        height,
        i,
        clampedFrames
      );

      const response = await openai.images.generate({
        model: "gpt-image-1",
        prompt: enhancedPrompt,
        size: "1024x1024",
        n: 1,
      });

      const b64 = response.data?.[0]?.b64_json;
      if (!b64) throw new Error("No image returned from OpenAI");
      frames.push(b64);
    }

    res.json({ frames, prompt, style });
  } catch (err: unknown) {
    logger.error({ err }, "AI sprite generation failed");
    const msg = err instanceof Error ? err.message : "Generation failed";
    res.status(500).json({ error: msg });
  }
});

// POST /ai/enhance-image
router.post("/enhance-image", async (req, res) => {
  try {
    const {
      imageBase64,
      prompt = "",
      style = "blasphemous",
      width = 32,
      height = 32,
    } = req.body as {
      imageBase64: string;
      prompt?: string;
      style?: string;
      width?: number;
      height?: number;
    };

    if (!imageBase64) {
      res.status(400).json({ error: "imageBase64 is required" });
      return;
    }

    const styleDesc = STYLE_PROMPTS[style] ?? STYLE_PROMPTS.blasphemous;
    const enhancePrompt =
      `Convert this image to ${styleDesc} pixel art style. ` +
      `Target size ${width}x${height} pixels, game-ready sprite, transparent background. ` +
      (prompt ? `Style guidance: ${prompt}.` : "");

    // Convert base64 to buffer for image edit
    const buf = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ""), "base64");
    const file = await OpenAI.toFile(buf, "input.png", { type: "image/png" });

    const response = await openai.images.edit({
      model: "gpt-image-1",
      image: file,
      prompt: enhancePrompt,
      size: "1024x1024",
      n: 1,
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image returned from OpenAI");

    res.json({ frames: [b64], prompt: enhancePrompt, style });
  } catch (err: unknown) {
    logger.error({ err }, "AI image enhancement failed");
    const msg = err instanceof Error ? err.message : "Enhancement failed";
    res.status(500).json({ error: msg });
  }
});

export default router;
