---
name: PixelForge AI engine architecture
description: Client-side procedural pixel art generation — no network calls, no OpenAI; key design decisions and quirks
---

## Summary
The AI sprite generation is 100% client-side in `artifacts/pixelforge/src/lib/pixelArtEngine.ts`.
`artifacts/api-server/src/routes/ai.ts` returns HTTP 410 with a message saying generation is now client-side.

## Key exports
- `generateSprite(prompt, w, h, style?, frameCountOverride?)` → `ImageData[]` — seeded so same prompt → same output
- `refineSprite(original, refinement, w, h, style?)` → `ImageData[]`
- `improveSprite(imageData, amount)` → `ImageData` — contrast/detail pass, no network
- `imageToPixelArt(src, w, h, palette?)` → `Promise<ImageData>` — nearest-neighbor resize + posterize/quantize
- `parsePrompt(prompt, stylePreset)` → `ParsedPrompt` — includes `seed: number` derived from prompt hash
- `SURPRISE_PROMPTS` — curated list of 45 prompts

## Seeded randomness
Uses mulberry32-style XOR-shift RNG seeded from FNV-1a hash of the prompt string.
Humanize and style-post passes each get their own derived seeds so frames are deterministic.

## Style post-processors (applyStylePost)
- `blasphemous` — darken + purple tint + occasional desaturation
- `gothic` — crush shadows, blow highlights, desaturate midtones with blue tint
- `retro8bit` — quantize to PICO-8 16-color palette + 2×2 block averaging
- `cyberpunk` — push warm pixels to magenta, cool pixels to cyan; darken shadows

## Subjects (45 total)
Characters: jester, wizard, mage, knight, warrior, archer, rogue, elf, humanoid,
  goblin, vampire, witch, demon, angel, reaper, zombie, wolf, spider, bat, gargoyle
Monsters/creatures: dragon, slime, skeleton, ghost, orc, mushroom, tree, flower
Items: chest, coin, key, torch, bomb, skull, crown, gem, tome, tombstone, door, rock,
  flame, axe, staff, potion, sword, shield
Isometric: isobox, isotile

## AIGenerator.tsx
No fetch calls. Imports directly from pixelArtEngine.
Actions: Generate, Improve Further, Humanize, Refine (panel), image upload → imageToPixelArt.
Palette size control (16/32/64) exposed in UI but currently informational (not wired to quantize).
Step animation uses setTimeout delays for perceived UX progress.

**Why:** User wanted no external API dependency — fully offline/deterministic generation.
