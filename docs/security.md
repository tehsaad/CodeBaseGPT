# Security and privacy

This is a summary of the controls implemented and how they're tested. It is **not** a formal audit or certification.

| Threat | Mitigation | Evidence |
|---|---|---|
| Authentication bypass | Every private route uses `withUser` (server-side session lookup). `proxy.ts` is only an optimistic redirect. | `tests/integration` 401 test; e2e redirect test |
| IDOR / cross-user leakage | `requireOwnedRepository` and `requireOwnedConversation` on every repo/conversation read, update, and delete. Saved items and web results are filtered by `owner_id`; non-owners get 404. | Integration "cross-user isolation" tests; e2e second-user test |
| CSRF | Better Auth origin checks; `SameSite=Lax` session cookies; JSON or multipart APIs only | — |
| Open redirect | `next` after sign-in must be a same-origin path (`/x`, not `//x` or `/\x`) | `components/auth/forms.tsx` |
| SSRF (repository import) | User input is reduced to `owner/repo@ref` by strict regexes. API URLs are built server-side, `redirect: "error"`, and the only allowed redirect is to `https://codeload.github.com` | Unit tests for 17 accepted and rejected inputs; integration test |
| SSRF (web results) | No server-side fetching of result pages; result URLs are validated before display | Unit tests |
| Path traversal / archive bombs | Entry-name validation, entry, size and ratio caps, in-memory extraction only | Unit and integration tests |
| Secret exposure | Secret files skipped, token formats redacted, logs scrubbed of credential-like keys and truncated, errors return generic messages without stack traces | Integration test checks `.env`, the key file, and the redacted token |
| Prompt injection | Strict instructions (policy first); evidence fenced and delimiter-neutralized; the model is told evidence is data; citation validation; no tools or actions available to the model | Integration test with an injection file; unit tests for fencing |
| XSS | React escaping; Markdown through `rehype-sanitize`; images dropped; external links limited to http(s) with `rel="noopener noreferrer nofollow"`; Shiki output is escaped; strict CSP | — |
| SQL injection | Drizzle parameterized queries throughout; tsquery terms limited to `[a-z0-9_]`; `LIKE` wildcards escaped | Unit test with an injection-shaped query |
| Abuse and resource exhaustion | Postgres-backed rate limits (chat 20/5 min, Stuck 10/5 min, search 20/5 min, import 5/10 min); Zod length caps; token budgets; graph caps; indexing limits | Integration test for the 429 path |
| Password storage | Argon2id; no plaintext; generic errors | Unit test |
| OAuth scope overreach | GitHub defaults to `read:user user:email`; the `repo` scope is opt-in; tokens encrypted at rest; a server `GITHUB_TOKEN` is never used for private repositories | — |

## Privacy

- Imported code is parsed, never executed.
- Only the retrieved snippets for a question (≈22 K characters at most) are sent to the configured model provider. Only the edited search queries are sent to the search provider.
- Deleting a repository deletes all derived data. Deleting your account (via the database) cascades to every owned row.

## Known gaps

- There is no automated malware or license scanning of imported code (it is never executed).
- The CSP allows `'unsafe-inline'` scripts because Next.js inline bootstrapping requires a nonce setup that isn't in place yet.
- Email verification is not enforced at sign-in, and requires an email provider.
