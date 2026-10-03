@AGENTS.md

# nextjs-fullstack

Next.js (App Router, TypeScript) template with shadcn/ui, Tailwind v4 and MongoDB via Mongoose.

## Commands (bun)

- `bun dev` — dev server. Needs MongoDB at `MONGODB_URI` (copy `.env.example` to `.env.local`).
- `./verify.sh` (`bun run verify`) — the baseline gate: format check, lint, typecheck, tests, build. Run it before claiming work is done.
- `bun run test` — Vitest. DB tests use `mongodb-memory-server`, so no local mongod is needed.
- `bun run e2e` — Playwright (Chromium) against a production build on port 3100 with an in-memory MongoDB; no local mongod or `.env.local` needed. First time on a machine: `bunx playwright install --only-shell chromium`. Tests live in `e2e/`, including an axe accessibility scan in both themes of `/`, `/sign-in`, `/sign-up`, `/forgot-password` and `/verify-email`, and of `/dashboard` inside the journey test. It is the contrast guard: add a new page to that list.
- `bun run audit` — dependency vulnerability scan (needs network, so it is not part of `verify.sh`; CI runs it). Run it before adding or upgrading a dependency. It ignores one advisory, `GHSA-vfj7-8cjw-p6xm` (`braces@3.0.3`): no patched release exists and it is reachable only through build tooling (`shadcn`, `eslint-config-next`). Remove the `--ignore` when a fix ships.

## Gates (mechanical, do not bypass)

- Git hooks live in `.githooks/` and are enabled by `bun install` (`prepare` sets `core.hooksPath`). `pre-commit` blocks env files and secret-shaped strings, then checks formatting, lints the staged files and typechecks. `pre-push` runs `./verify.sh`, then the end-to-end tests.
- Never use `--no-verify`, `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `any`, or `!` to get past a gate. Fix the code. A genuine exception goes in `eslint.config.mjs` as a per-file override with the reason recorded here.
- Formatting is Prettier (width 100, Tailwind classes sorted). Run `bun run format` before committing; do not hand-format. Markdown and `handwriting-text.tsx` are ignored in `.prettierignore`.
- Lint fails on any warning. Typed rules are on: every promise is awaited, returned or explicitly `void`ed.
- `noUncheckedIndexedAccess` is on: `array[0]` is `T | undefined`. Handle the missing case; do not assert it away.
- `src/components` and `src/lib` must not import from `src/features` or `src/app` (lint-enforced). Features may import shared code, never the reverse.
- `bunfig.toml` installs exact versions that are at least 3 days old. Do not lower the cooldown to get a fresh release.

- CI (Continuous Integration) is `.github/workflows/ci.yml`: audit, `./verify.sh`, then the end-to-end tests, on every push to the default branch and every pull request. Actions are pinned to commit hashes; Dependabot (`.github/dependabot.yml`) proposes weekly grouped updates for the actions only: it cannot read this `bun.lock` (lockfile version 2). Package updates are manual: `bun outdated`, then `bun update <name>`, `bun run audit` and `./verify.sh`.
- `main` on GitHub is protected: no force push, no deletion, and pull requests need the `verify` check. The owner can still push directly; the `pre-push` hook is the gate for that path.

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
- `src/features/auth` — Better Auth. `auth.ts` builds the instance lazily (`getAuth()`); `session.ts` has the guards. Auth collections belong to the library, not Mongoose. Forms and buttons call the intent functions in `client.ts` (`signIn`, `signUp`, ...), which never reject and return a tagged outcome; Better Auth error codes, statuses and callback paths are named only there. Route paths live in `paths.ts`. Google sign-in is registered only when both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set.
- `src/app/(auth)` — two route groups with their own layouts: `(split)` (sign-in, sign-up: brand panel beside the form) and `(card)` (verify-email, forgot-password, reset-password: centred card). `src/app/dashboard` is the protected area. `src/proxy.ts` only checks that a session cookie exists.
- `src/lib/db/mongoose.ts` — cached connection (`connectDb`). Call it inside services, not at module top level.
- `e2e/` — `server.mjs` builds, starts MongoDB in memory and runs `next start`, writing the server log to `.e2e/server.log`. `outbox.ts` reads emailed links from that log through `linkInEmailLog` in `src/features/auth/email.ts`, which also owns the format the stub prints (`emailLog`); change the two together. Keep a log transport for tests when a real provider lands. Sign-in is rate-limited to 5 per minute per IP, so keep sign-in attempts per run under that.
- `src/lib/env.ts` — the only place that reads `process.env` (lint-enforced; tests are exempt). `dbEnv()` and `authEnv()` validate with Zod on each call and throw an error that names the variable, never its value. `googleEnv()` never throws: it returns the credentials only when both variables are set, and when exactly one is set it logs a warning naming the missing one, at most once per loaded copy of the module (so it can repeat across server bundles or dev reloads). Add a new variable to its schema here and to `.env.example`.
- `src/components` — shared components that are not shadcn: `masthead.tsx` (the top strip of every page), `brand.ts` (shared brand copy), `text-link.tsx`, `theme-toggle.tsx`.
- `src/components/ui` — shadcn components. Add more with `bunx --bun shadcn@latest add <name>`.

## Conventions

- Validate all input with Zod at the Server Action / Route Handler boundary.
- Server Actions write; Route Handlers are for external clients.
- Every private page and Server Action starts with `requireSession()` or `requireAdmin()` from `src/features/auth/session.ts`. `src/proxy.test.ts` checks pages for a forgotten guard (a text check, not proof that the call comes first): every page under a path in the proxy's matcher must await a guard, and every page that awaits one must be under the matcher, so add a new private area to the matcher in `src/proxy.ts`. Server Actions are not checked yet. Roles (`user`, `admin`) are set once at account creation from `ADMIN_EMAILS`.
- Colour, type and shape come from the design system below. Use semantic classes (`bg-card`, `text-muted-foreground`), not raw colors.
- `src/features/auth/email.ts` is a stub that logs the email instead of sending it; its `no-console` exception in `eslint.config.mjs` goes away when a real provider lands.
- `src/components/ui/handwriting-text.tsx` is a verbatim third-party component; its lint exceptions are in `eslint.config.mjs`. The landing page self-hosts its font at `public/fonts/handwriting.ttf` (the default CDN font is blocked by CORS). It still loads opentype.js from a CDN at runtime and falls back to plain text if that fails.

## Design system (Linen Editorial)

The brand as a printed magazine: warm paper, ink text, one terracotta voice. Decision and token table: `docs/specs/linen-editorial-design-system.md` (local-only).

- **Tokens** (oklch, light and `.dark`) live in `src/app/globals.css`; `--radius` is `0px`. Primary is terracotta in light, clay in dark; the label on it is `primary-foreground`. Do not put opacity on text (`text-primary-foreground/70` failed contrast); pick a token.
- **Type**: `font-display` (Instrument Serif, regular or italic, never bold) for page titles and card titles, with at most one italic `text-primary` word in a hero. Body text is Google Sans Flex. Labels and buttons are Google Sans Code: `font-mono text-xs tracking-widest uppercase`.
- **Shape**: square corners; structure is drawn with rules (`border-foreground` for major edges, `border-border` between rows), not rings or shadows. Fields are underlined, cards have a 1px `foreground` outline. Button sizes: `xs` 24, `sm` 32, default 40, `lg` 44 px; use `size="lg"` for a form's main action. There is no `large` input variant.
- **Layout**: every page opens with `Masthead` (pages pass their actions as children). `HandwritingText` is the single decorative accent, at most one per screen, on the terracotta panel.
- **Prototypes** of the three directions that were compared are on the branch `prototype/design-system`. Never merge it.

## Next steps (not built yet)

- Unused-code check: `knip` was tried and dropped. Its native resolver binding is blocked by Windows Application Control on the development machine, so it could not be run or verified locally.
- Deployment config (none yet; defaults work on Vercel). Auth rate limits are per client IP taken from `x-forwarded-for`; off Vercel, configure `advanced.ipAddress` in `src/features/auth/auth.ts` first or all clients share one bucket.

## Agent skills

### Issue tracker

Local markdown: specs in `docs/specs/<feature>.md`, tickets in `.scratch/<feature>/issues/` (both local-only, excluded from git). See `docs/agents/issue-tracker.md`.

### Triage labels

The five default roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), recorded on each ticket's `**Status:**` line. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root, created lazily. See `docs/agents/domain.md`.
