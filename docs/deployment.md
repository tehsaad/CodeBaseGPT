# Deploying to Vercel

CodeBaseGPT is a single Next.js 16 app: pages, API route handlers and background indexing all run on Vercel Functions (Node.js runtime). There is no separate backend service.

## 1. Database (required)

Production **requires** `DATABASE_URL`. The app refuses to start on Vercel without it, because the embedded development database would lose data.

1. Create a Postgres database. Neon (Vercel Marketplace → Neon) is recommended; any PostgreSQL 15+ with the `vector` and `pg_trgm` extensions works (Supabase, RDS, and so on).
2. Copy the **pooled** connection string into `DATABASE_URL`.
3. Apply the migrations from your machine (or from CI):

   ```bash
   DATABASE_URL="postgres://..." npm run db:migrate
   ```

   Migration `0000_extensions` runs `CREATE EXTENSION IF NOT EXISTS vector` and `pg_trgm`. If your role can't create extensions, enable them in the provider's dashboard first. Migrations are idempotent and tracked by Drizzle.

   To migrate on every deploy instead, set the Vercel build command to `npm run db:migrate && npm run build`. Only do this if you're comfortable with schema changes being applied automatically on deploy.

## 2. Environment variables

Set these in **Vercel → Project → Settings → Environment Variables** (or with `vercel env add`). The full list, with descriptions, is in [`.env.example`](../.env.example).

| Variable | Production | Purpose |
|---|---|---|
| `DATABASE_URL` | **required** | Postgres connection string |
| `BETTER_AUTH_SECRET` | **required** | 32+ random bytes (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | **required** | Public origin, e.g. `https://codebasegpt.vercel.app` |
| `GEMMA_MODEL`, `GEMMA_API_KEY` (+ `GEMMA_PROVIDER`, `GEMMA_BASE_URL`) | for answers | See [gemma.md](gemma.md) |
| `TAVILY_API_KEY` or `EXA_API_KEY` | for Stuck Mode web search | See [web-search.md](web-search.md) |
| `GITHUB_CLIENT_ID/SECRET`, `GOOGLE_CLIENT_ID/SECRET` | for OAuth | See [authentication.md](authentication.md) |
| `RESEND_API_KEY`, `EMAIL_FROM` | for password reset email | optional |
| `EMBEDDING_PROVIDER=google` | optional | semantic retrieval with pgvector |
| `GITHUB_TOKEN` | optional | higher GitHub rate limit for public imports (public-read fine-grained token only) |

All provider keys are read only on the server. None use the `NEXT_PUBLIC_` prefix, so none reach the browser bundle.

## 3. OAuth callback URLs

| Provider | Local | Production |
|---|---|---|
| GitHub | `http://localhost:3000/api/auth/callback/github` | `https://<your-domain>/api/auth/callback/github` |
| Google | `http://localhost:3000/api/auth/callback/google` | `https://<your-domain>/api/auth/callback/google` |

Preview deployments get different URLs. Either use a separate OAuth app per environment, or test OAuth only on the production domain.

## 4. Deploy

```bash
npm i -g vercel
vercel link
vercel env pull .env.local   # optional: use the same values locally
vercel deploy                # preview
vercel deploy --prod         # production, once the preview checks out
```

Or connect the GitHub repository in the Vercel dashboard so every push creates a preview.

## 5. Runtime notes

- **Indexing.** The import request downloads and filters the archive (≤ 30 MB), then indexing continues in the background with `after()` (up to ~250 s per invocation, `maxDuration = 300`). Jobs are stored in Postgres with a lease, so if a function times out or a user leaves, the next request resumes where it stopped: the repository page drives `POST /api/repos/:id/index { action: "step" }` while a job is active. No external queue is required. For very large repositories, Vercel Queues or Workflow could replace the client-driven step loop.
- **Tree-sitter grammars** are vendored WASM files in `lib/code-intelligence/grammars`, included in function bundles through `outputFileTracingIncludes` in `next.config.ts`.
- **Request bodies** are limited to 4.5 MB on Vercel, so ZIP uploads are capped at 4 MB.
- **Security headers** (CSP, HSTS, `frame-ancestors 'none'`, `nosniff`, Referrer-Policy and Permissions-Policy) are set in `next.config.ts`.
- **Rate limits** for sign-in and sign-up (Better Auth) and for chat, search and import (the `app_rate_limit` table) are stored in Postgres, so they hold across function instances.

## 6. Post-deploy checklist

- [ ] `GET /api/status` shows `gemma.configured: true` and `search.configured: true` if you configured them
- [ ] Sign up with email, then sign out and back in
- [ ] GitHub and Google sign-in round-trip (if configured)
- [ ] Import `sindresorhus/ky` and confirm the status reaches **Indexed** and the Atlas shows `source/`
- [ ] Ask a question and click a citation; the source opens at the cited lines
- [ ] Use Stuck Mode with a real error and confirm the web sources link to real pages
- [ ] Sign in as a second user and confirm the first user's repository URL returns "Repository not found"

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `DATABASE_URL is not set` on Vercel | Set it for the environment (Production/Preview) and redeploy |
| `extension "vector" is not available` during migrate | Enable pgvector in your provider's dashboard, or use Neon |
| OAuth `redirect_uri_mismatch` | The callback URL must match `BETTER_AUTH_URL` exactly (scheme, host, no trailing slash) |
| Import fails with "rate limit reached" | Unauthenticated GitHub API is 60 requests/hour per IP. Set `GITHUB_TOKEN` or connect GitHub in Settings |
| Answers say "Gemma is not configured" | `GEMMA_MODEL` and `GEMMA_API_KEY` (or `GEMMA_BASE_URL`) are missing in that environment |
| "The configured GEMMA_MODEL was not found" | The model ID isn't served by your provider; list available models (see gemma.md) |
