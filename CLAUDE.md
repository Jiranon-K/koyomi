@AGENTS.md

# nextjs-fullstack

Next.js (App Router, TypeScript) template with shadcn/ui, Tailwind v4 and MongoDB via Mongoose.

## Commands (bun)

- `bun dev` — dev server. Needs MongoDB at `MONGODB_URI` (copy `.env.example` to `.env.local`).
- `./verify.sh` (`bun run verify`) — the baseline gate: lint, typecheck, tests, build. Run it before claiming work is done.
- `bun run test` — Vitest. DB tests use `mongodb-memory-server`, so no local mongod is needed.

## Layout

- `src/app` — routes. `/` is the landing page, `/tasks` is the example feature, `/api/tasks` is the example Route Handler.
- `src/features/<name>` — one folder per feature: `model.ts` (Mongoose), `schema.ts` (Zod), `service.ts` (DB logic), `actions.ts` (Server Actions), UI.
- `src/lib/db/mongoose.ts` — cached connection (`connectDb`). Call it inside services, not at module top level.
- `src/components/ui` — shadcn components. Add more with `bunx --bun shadcn@latest add <name>`.

## Conventions

- Validate all input with Zod at the Server Action / Route Handler boundary.
- Server Actions write; Route Handlers are for external clients.
- Theme tokens (Linen Stone, oklch) live in `src/app/globals.css`. Use semantic classes (`bg-card`, `text-muted-foreground`), not raw colors.
- `src/components/ui/handwriting-text.tsx` is a verbatim third-party component; its lint exception is in `eslint.config.mjs`. It loads opentype.js and a font from CDNs at runtime and falls back to plain text.
- The Task feature is an example. Delete `src/features/tasks`, `src/app/tasks`, `src/app/api/tasks` and the landing link when starting real work.

## Next steps (not built yet)

- Authentication with Better Auth.
- Deployment config (none yet; defaults work on Vercel).
