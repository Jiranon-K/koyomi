@AGENTS.md

# nextjs-fullstack

Next.js (App Router, TypeScript) template with shadcn/ui, Tailwind v4 and MongoDB via Mongoose.

## Commands (bun)

- `bun dev` — dev server. Needs MongoDB at `MONGODB_URI` (copy `.env.example` to `.env.local`).
- `./verify.sh` (`bun run verify`) — the baseline gate: lint, typecheck, tests, build. Run it before claiming work is done.
- `bun run test` — Vitest. DB tests use `mongodb-memory-server`, so no local mongod is needed.

## Layout

- `src/app` — routes. `/` is the landing page.
- `src/features/<name>` — one folder per feature (`auth` so far): `model.ts` (Mongoose), `schema.ts` (Zod), `service.ts` (DB logic), `actions.ts` (Server Actions), UI.
- `src/features/auth` — Better Auth. `auth.ts` builds the instance lazily (`getAuth()`); `session.ts` has the guards. Auth collections belong to the library, not Mongoose. Forms call the React client in `client.ts`; route paths live in `paths.ts`.
- `src/app/(auth)` — sign-in, sign-up and verify-email pages. `src/app/dashboard` is the protected area. `src/proxy.ts` only checks that a session cookie exists.
- `src/lib/db/mongoose.ts` — cached connection (`connectDb`). Call it inside services, not at module top level.
- `src/components/ui` — shadcn components. Add more with `bunx --bun shadcn@latest add <name>`.

## Conventions

- Validate all input with Zod at the Server Action / Route Handler boundary.
- Server Actions write; Route Handlers are for external clients.
- Every private page and Server Action starts with `requireSession()` or `requireAdmin()` from `src/features/auth/session.ts`. Roles (`user`, `admin`) are set once at account creation from `ADMIN_EMAILS`.
- Theme tokens (Linen Stone, oklch) live in `src/app/globals.css`. Use semantic classes (`bg-card`, `text-muted-foreground`), not raw colors.
- `src/components/ui/handwriting-text.tsx` is a verbatim third-party component; its lint exception is in `eslint.config.mjs`. The landing page self-hosts its font at `public/fonts/handwriting.ttf` (the default CDN font is blocked by CORS). It still loads opentype.js from a CDN at runtime and falls back to plain text if that fails.

## Next steps (not built yet)

- Rest of authentication (tickets in `.scratch/better-auth/issues`): forgot/reset password screens, rate limiting, Google sign-in.
- Deployment config (none yet; defaults work on Vercel).
