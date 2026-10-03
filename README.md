# Koyomi

An anime airing tracker with LINE reminders. Koyomi shows the airing schedule of the current anime
season in Thai time, lets a signed-in viewer follow shows, and sends one LINE message on each day a
followed show airs.

Built with Next.js (App Router, TypeScript), shadcn/ui, Tailwind v4, MongoDB via Mongoose and
authentication with Better Auth.

Status: the schedule, follows, LINE Login and the daily LINE digest are built; the digest has not
yet been run against a real QStash account and LINE channel. The bot's replies and the admin page
are not built yet.

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
| `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` | for reminders | Messaging API channel access token the daily digest is pushed with. |
| `QSTASH_TOKEN` | for scheduled jobs | Upstash QStash token the app publishes jobs with. |
| `QSTASH_URL` | no | QStash API address when the account is not in the default region. |
| `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` | for scheduled jobs | Keys QStash signs its calls with; without both, every job endpoint refuses every call. |

The schedule source and LINE Login variables, and the console steps for each service, are in
`.env.example`.

Never commit `.env.local`.

## Scheduled jobs and the daily digest

Background work runs through [Upstash QStash](https://upstash.com/docs/qstash), which calls
signature-checked endpoints under `/api/jobs/`:

- `sync-schedule`: every six hours, and at 08:45 Bangkok time.
- `digest-fanout`: at 09:00 Bangkok time. It enqueues one `digest-send` job for each user with
  reminders on who follows an episode airing that day; each of those pushes one LINE message.

A digest is sent at most once per user and day however often a job is retried, is skipped when the
last successful sync is more than 24 hours old, and stops at 290 pushes per month.

Creating the Upstash QStash account is a manual step. After deploying with the QStash variables set,
create the three schedules once (safe to repeat; it overwrites them by id):

```bash
bun scripts/create-qstash-schedules.ts --dry-run   # print what would be created
bun scripts/create-qstash-schedules.ts
```

Run it with `QSTASH_TOKEN` and the deployed `BETTER_AUTH_URL` in the environment; QStash cannot call
`localhost`.

## Authentication

- Email and password with required email verification, password reset, a protected `/dashboard`,
  and roles (`user`, `admin`).
- Emails are printed to the server console in development (`src/features/auth/email.ts`). Open the
  logged link to verify an address or reset a password. Swap that one function for a real provider
  in production.
- Auth endpoints are rate limited per client IP. The IP is read from `x-forwarded-for` as Vercel
  sends it; on other hosting configure `advanced.ipAddress` in `src/features/auth/auth.ts` first.
- An email listed in `ADMIN_EMAILS` becomes an admin when its account is first created.
