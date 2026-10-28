# Authentication

CodeBaseGPT uses **[Better Auth](https://better-auth.com) 1.7** with the Drizzle adapter and **database-backed sessions**.

### Why not Auth.js?

The original brief preferred Auth.js. As of this build (October 2026), Auth.js v5 is still a beta (`next-auth@5.0.0-beta.32`). Its credentials provider requires JWT sessions and has no built-in registration, password hashing, or rate limiting. Better Auth is stable and natively provides email/password sign-up, GitHub and Google OAuth, database sessions, account linking, encrypted OAuth tokens, password reset, and database-backed rate limiting.

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
| CSRF | Better Auth's origin check is forced on (`disableOriginCheck: false`; the library would otherwise skip it under `NODE_ENV=test`). Trusted origins are `BETTER_AUTH_URL` plus Vercel's `VERCEL_URL`, `VERCEL_BRANCH_URL` and `VERCEL_PROJECT_PRODUCTION_URL`, so preview deployments work. App APIs accept JSON or multipart bodies only, with `SameSite=Lax` cookies. Covered by `tests/integration/auth-origin.test.ts`. |

## Setting up GitHub OAuth

Create one OAuth App per environment (GitHub allows a single callback URL per app).

| Field | Production | Local development |
|---|---|---|
| Where | https://github.com/settings/applications/new | same |
| Homepage URL | `https://codebasegpt.vercel.app` | `http://localhost:3000` |
| Authorization callback URL | `https://codebasegpt.vercel.app/api/auth/callback/github` | `http://localhost:3000/api/auth/callback/github` |
| Enable Device Flow | off | off |

Generate a client secret, then set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`. Sign-in requests `read:user user:email`; users whose GitHub email is private still work because the `user:email` scope lets Better Auth read their verified primary address.

## Setting up Google OAuth

1. https://console.cloud.google.com/auth/branding: set up the consent screen (app name CodeBaseGPT, support email, authorised domain `codebasegpt.vercel.app`). Audience **External**. Scopes: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` (non-sensitive, so no Google verification is needed). While the app is in *Testing*, only listed test users can sign in; choose **Publish app** to open it to everyone.
2. https://console.cloud.google.com/auth/clients → **Create client** → *Web application*.
   - Authorised JavaScript origins: `https://codebasegpt.vercel.app` (and `http://localhost:3000` for development)
   - Authorised redirect URIs: `https://codebasegpt.vercel.app/api/auth/callback/google` (and `http://localhost:3000/api/auth/callback/google`)
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

Preview deployments use their own URLs, which aren't registered with either provider, so OAuth only works on the production domain and localhost.

## Account linking

`accountLinking` trusts GitHub and Google, but Better Auth's `requireLocalEmailVerified` (default **true**) still applies: an OAuth sign-in is only linked to an existing email/password account whose email has been verified. This blocks pre-registration takeover (someone signing up with a victim's address before the victim uses Google). Without email verification, a user who registered with a password and then tries Google with the same address gets a clear "sign in with your password first" message (`account_not_linked`).

## Setting up email (Resend)

Password reset and email verification switch on when both are set:

- `RESEND_API_KEY`: a **sending-access** key restricted to the verified domain (Resend → API Keys → Create, permission *Sending access*, domain `tehsaad.site`).
- `EMAIL_FROM`: an address on that domain, for example `CodeBaseGPT <no-reply@tehsaad.site>`.

With email enabled, new sign-ups receive a verification link, and verified accounts can be linked to GitHub/Google automatically.

## Applying changes on Vercel

Add the variables to the **Production** environment (mark secrets *Sensitive*), then redeploy: environment changes only reach new deployments.

## Verification status

Credentials auth, sessions, generic errors, protected routes, and cross-user isolation are covered by automated integration and end-to-end tests. **GitHub and Google OAuth round-trips were not exercised**, because no OAuth credentials were available while building. The provider configuration follows Better Auth's documented options and should be verified once credentials are added (see the deployment checklist).
