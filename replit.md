# PixelForge

A browser-based pixel art editor with layers, animation timeline, and an AI sprite generator.

## Run & Operate

Managed workflows auto-start via Replit — no manual commands needed during development.

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` (auto-provisioned), `OPENAI_API_KEY` (user-provided)

## Stack

- pnpm workspaces, Node.js 20, TypeScript 5.9
- Frontend: React + Vite (`artifacts/pixelforge/`) — dark gothic pixel art editor UI
- API: Express 5 (`artifacts/api-server/`) — AI generation + projects CRUD
- DB: PostgreSQL + Drizzle ORM (`lib/db/`)
- AI: OpenAI gpt-image-1 for pixel art generation (user's own OPENAI_API_KEY)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec at `lib/api-spec/openapi.yaml`)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/db/src/schema/projects.ts` — DB schema (projects table)
- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `artifacts/api-server/src/routes/ai.ts` — AI sprite generation routes
- `artifacts/api-server/src/routes/projects.ts` — projects CRUD routes
- `artifacts/pixelforge/src/App.tsx` — main editor layout & navigation
- `artifacts/pixelforge/src/components/AIGenerator.tsx` — AI panel with real API calls
- `artifacts/pixelforge/src/hooks/usePixelEditor.ts` — editor state management
- `artifacts/pixelforge/src/lib/pixelEngine.ts` — drawing algorithms (Bresenham line, flood fill, etc.)

## Architecture decisions

- AI generation uses gpt-image-1 at 1024×1024, then downsampled to target pixel-art resolution via nearest-neighbor interpolation on an HTML canvas — this preserves crisp pixel edges.
- Projects are saved to PostgreSQL via the projects API; localStorage is kept as autosave fallback.
- The Vite dev server proxies `/api` requests to the Express server (port 8080) for local development.
- Orval generates typed React Query hooks from the OpenAPI spec — run codegen after any spec change.
- Style prompts for AI generation are server-side (in `ai.ts`) to keep them consistent and prevent client-side tampering.

## Product

PixelForge Pro is an AI-powered pixel art studio for game developers. Key features:
- **AI Studio**: Text-to-pixel-art generation (gpt-image-1) with style presets (Blasphemous, 8-bit, 16-bit, Isometric, Gothic, Cyberpunk), multi-frame animation generation, image-to-pixel-art conversion
- **Full pixel editor**: Pencil, eraser, flood fill, shapes, eyedropper, selection, move, onion skinning, layers, undo/redo
- **Animation timeline**: Frame management, playback, FPS control
- **Models Library**: Save/load projects to PostgreSQL with thumbnails and search
- **Export**: PNG, sprite sheets, GIF

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
