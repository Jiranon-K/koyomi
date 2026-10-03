# nextjs-fullstack

Next.js (App Router, TypeScript) template with shadcn/ui, Tailwind v4, MongoDB via Mongoose and
authentication with Better Auth.

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
| `GOOGLE_CLIENT_ID` | no | Google OAuth client id. |
| `GOOGLE_CLIENT_SECRET` | no | Google OAuth client secret. |

Never commit `.env.local`.

## Authentication

- Email and password with required email verification, password reset, a protected `/dashboard`,
  and roles (`user`, `admin`).
- Emails are printed to the server console in development (`src/features/auth/email.ts`). Open the
  logged link to verify an address or reset a password. Swap that one function for a real provider
  in production.
- Auth endpoints are rate limited per client IP. The IP is read from `x-forwarded-for` as Vercel
  sends it; on other hosting configure `advanced.ipAddress` in `src/features/auth/auth.ts` first.

### Google sign-in (optional)

Google sign-in is off until **both** `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set. While
it is off the "Continue with Google" button is hidden, and the app, the build and the tests work
without any Google configuration. If only one of the two is set, Google sign-in stays off and the
server log gets a warning naming the missing variable.

To turn it on:

1. Open the [Google Cloud Console](https://console.cloud.google.com/) and create or pick a project.
2. Under **APIs & Services > OAuth consent screen**, configure the consent screen (app name,
   support email). The default scopes (email, profile, openid) are enough.
3. Under **APIs & Services > Credentials**, choose **Create credentials > OAuth client ID** with
   application type **Web application**.
4. Add an **Authorized redirect URI** for every environment, following this pattern:

   ```
   <BETTER_AUTH_URL>/api/auth/callback/google
   ```

   For local development that is `http://localhost:3000/api/auth/callback/google`. The URI must
   match exactly, including scheme and port.
5. Copy the client id and client secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in
   `.env.local` (or your host's environment settings) and restart the server.

How Google accounts map to app accounts:

- Google sign-in only succeeds when Google reports the email as verified.
- If an account with that email already exists and is verified, Google signs in to that account.
- If an account with that email exists but was never verified, Google sign-in is refused until the
  address is verified through the emailed link.
- An email listed in `ADMIN_EMAILS` becomes an admin when its account is first created, whichever
  sign-in method created it.
