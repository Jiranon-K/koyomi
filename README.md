# Koyomi

An anime airing tracker with LINE reminders. Koyomi shows the airing schedule of the current anime
season in Thai time, lets a signed-in viewer follow shows, and sends one LINE message on each day a
followed show airs.

Built with Next.js (App Router, TypeScript), shadcn/ui, Tailwind v4, MongoDB via Mongoose and
authentication with Better Auth.

Status: the schedule, follows and LINE reminders are not built yet. Today the app has the landing
page, email and password accounts, and a protected dashboard.

## Getting started

1. Copy `.env.example` to `.env.local` and fill in the values (see below).
2. Start MongoDB at the address in `MONGODB_URI`.
3. Run the dev server:

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

Before calling work done, run the baseline gate (lint, typecheck, tests, production build):

```bash
./verify.sh
```

Tests use an in-memory MongoDB, so they need no local database and no secrets.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | yes | MongoDB connection string. |
| `BETTER_AUTH_SECRET` | yes | Signing secret, at least 32 random characters. |
| `BETTER_AUTH_URL` | yes | Public origin of the app, no trailing slash. |
| `ADMIN_EMAILS` | no | Comma-separated emails that become admins when their account is created. |

Never commit `.env.local`.

## Authentication

- Email and password with required email verification, password reset, a protected `/dashboard`,
  and roles (`user`, `admin`).
- Emails are printed to the server console in development (`src/features/auth/email.ts`). Open the
  logged link to verify an address or reset a password. Swap that one function for a real provider
  in production.
- Auth endpoints are rate limited per client IP. The IP is read from `x-forwarded-for` as Vercel
  sends it; on other hosting configure `advanced.ipAddress` in `src/features/auth/auth.ts` first.
- An email listed in `ADMIN_EMAILS` becomes an admin when its account is first created.
