# Authentication

CodeBaseGPT uses **[Better Auth](https://better-auth.com) 1.7** with the Drizzle adapter and **database-backed sessions**.

### Why not Auth.js?

The original brief preferred Auth.js. As of this build (October 2026), Auth.js v5 is still a beta (`next-auth@5.0.0-beta.32`). Its credentials provider requires JWT sessions and has no built-in registration, password hashing, or rate limiting. Better Auth is stable and natively provides email/password sign-up, GitHub and Google OAuth, database sessions, account linking, encrypted OAuth tokens, password reset, and database-backed rate limiting. The Auth.js maintainers have also joined the Better Auth project.

## What is implemented

| Feature | Details |
|---|---|
| Email and password | Sign-up with 10–128 character passwords. Hashing uses **Argon2id** (`@node-rs/argon2`, m = 19 MiB, t = 2, p = 1, per OWASP). |
| Sessions | HTTP-only, `SameSite=Lax` cookies backed by the `session` table. 7-day expiry, refreshed daily. `Secure` on HTTPS. |
| Generic errors | Sign-in failures always say "Email or password is incorrect." Sign-up failures don't reveal whether the account exists. |
| Rate limiting | `/sign-in/email` allows 5 per minute; `/sign-up/email` 5 per 5 minutes; password reset 3 per 5 minutes. Counters live in Postgres. |
| GitHub OAuth | Scopes `read:user user:email`. Private-repository import is **opt-in** from Settings, which requests the additional `repo` scope. |
| Google OAuth | Default `openid email profile` scopes |
| Token storage | OAuth access and refresh tokens are encrypted at rest (`encryptOAuthTokens`) and never sent to the browser. |
| Password reset / email verification | Enabled only when `RESEND_API_KEY` and `EMAIL_FROM` are set. Otherwise the UI explains that it's unavailable. |
| Route protection | `proxy.ts` redirects signed-out visitors (an optimistic cookie check). Every API route re-validates the session (`withUser`) and resource ownership (`requireOwnedRepository` / `requireOwnedConversation`). Other users' resources return **404**, not 403. |
| CSRF | Better Auth checks `Origin` against `BETTER_AUTH_URL`. App APIs accept JSON or multipart bodies only and rely on `SameSite=Lax` cookies. |

## Setting up GitHub OAuth

1. Go to https://github.com/settings/developers → **New OAuth App**.
2. Homepage URL: your `BETTER_AUTH_URL`.
3. Authorization callback URL: `<BETTER_AUTH_URL>/api/auth/callback/github`
4. Copy the client ID and a new client secret into `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.

## Setting up Google OAuth

1. In https://console.cloud.google.com/apis/credentials, create an **OAuth client ID** of type *Web application*.
2. Authorized JavaScript origin: your `BETTER_AUTH_URL`.
3. Authorized redirect URI: `<BETTER_AUTH_URL>/api/auth/callback/google`
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and configure the consent screen.

Until both values are set, the matching button is disabled with an explanation. No fake OAuth flow is shown.

## Verification status

Credentials auth, sessions, generic errors, protected routes, and cross-user isolation are covered by automated integration and end-to-end tests. **GitHub and Google OAuth round-trips were not exercised**, because no OAuth credentials were available while building. The provider configuration follows Better Auth's documented options and should be verified once credentials are added (see the deployment checklist).
