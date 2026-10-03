@AGENTS.md

# nextjs-fullstack

Next.js (App Router, TypeScript) template with shadcn/ui, Tailwind v4 and MongoDB via Mongoose.

## Commands (bun)

- `bun dev` — dev server. Needs MongoDB at `MONGODB_URI` (copy `.env.example` to `.env.local`).
- `./verify.sh` (`bun run verify`) — the baseline gate: lint, typecheck, tests, build. Run it before claiming work is done.
- `bun run test` — Vitest. DB tests use `mongodb-memory-server`, so no local mongod is needed.
- `bun run audit` — dependency vulnerability scan (needs network, so it is not part of `verify.sh`). Run it before adding or upgrading a dependency.

## Gates (mechanical, do not bypass)

- Git hooks live in `.githooks/` and are enabled by `bun install` (`prepare` sets `core.hooksPath`). `pre-commit` blocks env files and secret-shaped strings, then lints the staged files and typechecks. `pre-push` runs `./verify.sh`.
- Never use `--no-verify`, `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `any`, or `!` to get past a gate. Fix the code. A genuine exception goes in `eslint.config.mjs` as a per-file override with the reason recorded here.
- Lint fails on any warning. Typed rules are on: every promise is awaited, returned or explicitly `void`ed.
- `noUncheckedIndexedAccess` is on: `array[0]` is `T | undefined`. Handle the missing case; do not assert it away.
- `src/components` and `src/lib` must not import from `src/features` or `src/app` (lint-enforced). Features may import shared code, never the reverse.
- `bunfig.toml` installs exact versions that are at least 3 days old. Do not lower the cooldown to get a fresh release.

## Workflow (one ticket at a time)

1. Idea → `/grilling` until the open questions are settled.
2. Spec → `docs/specs/<feature>.md`.
3. Tickets → `.scratch/<feature>/issues/NN-<slug>.md`, each a vertical slice with checkbox acceptance criteria.
4. Implement one ticket test-first (`/tdd`): failing test, minimal code, refactor. Only one ticket is `in progress` at a time.
5. `./verify.sh` green → record the command and result in the ticket → `/code-review` → commit. One ticket per commit; the message names the ticket and what was verified.
6. UI tickets also need a recorded browser check before they are `done`.

## Layout

- `src/app` — routes. `/` is the landing page.
- `src/features/<name>` — one folder per feature (`auth` so far): `model.ts` (Mongoose), `schema.ts` (Zod), `service.ts` (DB logic), `actions.ts` (Server Actions), UI.
- `src/features/auth` — Better Auth. `auth.ts` builds the instance lazily (`getAuth()`); `session.ts` has the guards. Auth collections belong to the library, not Mongoose. Forms call the React client in `client.ts`; route paths live in `paths.ts`. Google sign-in is registered only when both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set.
- `src/app/(auth)` — two route groups with their own layouts: `(split)` (sign-in, sign-up: brand panel beside the form) and `(card)` (verify-email, forgot-password, reset-password: centred card). `src/app/dashboard` is the protected area. `src/proxy.ts` only checks that a session cookie exists.
- `src/lib/db/mongoose.ts` — cached connection (`connectDb`). Call it inside services, not at module top level.
- `src/components/ui` — shadcn components. Add more with `bunx --bun shadcn@latest add <name>`.

## Conventions

- Validate all input with Zod at the Server Action / Route Handler boundary.
- Server Actions write; Route Handlers are for external clients.
- Every private page and Server Action starts with `requireSession()` or `requireAdmin()` from `src/features/auth/session.ts`. Roles (`user`, `admin`) are set once at account creation from `ADMIN_EMAILS`.
- Theme tokens (Linen Stone, oklch) live in `src/app/globals.css`. Use semantic classes (`bg-card`, `text-muted-foreground`), not raw colors.
- `src/features/auth/email.ts` is a stub that logs the email instead of sending it; its `no-console` exception in `eslint.config.mjs` goes away when a real provider lands.
- `src/components/ui/handwriting-text.tsx` is a verbatim third-party component; its lint exceptions are in `eslint.config.mjs`. The landing page self-hosts its font at `public/fonts/handwriting.ttf` (the default CDN font is blocked by CORS). It still loads opentype.js from a CDN at runtime and falls back to plain text if that fails.

## Next steps (not built yet)

- Deployment config (none yet; defaults work on Vercel). Auth rate limits are per client IP taken from `x-forwarded-for`; off Vercel, configure `advanced.ipAddress` in `src/features/auth/auth.ts` first or all clients share one bucket.

## Agent skills

### Issue tracker

Local markdown: specs in `docs/specs/<feature>.md`, tickets in `.scratch/<feature>/issues/` (both local-only, excluded from git). See `docs/agents/issue-tracker.md`.

### Triage labels

The five default roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), recorded on each ticket's `**Status:**` line. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root, created lazily. See `docs/agents/domain.md`.
