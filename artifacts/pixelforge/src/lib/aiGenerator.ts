/**
 * aiGenerator – thin wrapper around the structured PixelArtEngine.
 * Keeps the same interface the rest of the app expects.
 */
import { generateSprite, refineSprite, parsePrompt } from './pixelArtEngine';

export const aiGenerator = {
  /**
   * Generate one frame of pixel art from a text prompt.
   * Returns a standard ImageData ready to be put on a canvas.
   */
  generate(prompt: string, width: number, height: number): ImageData {
    const frames = generateSprite(prompt, width, height);
    return frames[0];
  },

  /**
   * Generate multiple animation frames from a prompt.
   * Returns an array of ImageData.
   */
  generateFrames(prompt: string, width: number, height: number): ImageData[] {
    return generateSprite(prompt, width, height);
  },

  /**
   * Refine an existing sprite by combining the original prompt with new instructions.
   */
  refine(originalPrompt: string, refinement: string, width: number, height: number): ImageData[] {
    return refineSprite(originalPrompt, refinement, width, height);
  },

  /**
   * Returns true if this prompt would produce multiple animation frames.
   */
  isAnimated(prompt: string): boolean {
    return parsePrompt(prompt).animated;
  },
};
