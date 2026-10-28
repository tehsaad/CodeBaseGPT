# Local development

```bash
npm install
npm run dev            # http://localhost:3000, embedded Postgres in .data/pglite
```

- Reset local data: stop the server and delete `.data/pglite`.
- To use a real Postgres locally, set `DATABASE_URL` and run `npm run db:migrate`.
- After changing `lib/db/schema.ts`, run `npm run db:generate` and commit the new file in `drizzle/`.
- `npm run check` runs typecheck, lint, and unit and integration tests.
- `npm run test:e2e` starts a dev server on port 3210 with a fresh database and runs Playwright (desktop and Pixel 7).
- To run the production build locally without a hosted database: `CBG_ALLOW_EMBEDDED_DB=1 npm run build && CBG_ALLOW_EMBEDDED_DB=1 npm start`. Never do this on Vercel.

## Adding a language

1. Add the grammar's `.wasm` to `lib/code-intelligence/grammars/` (built against tree-sitter ABI 14/15; the npm `tree-sitter-<lang>` packages ship one), and record it in `VERSIONS.txt`.
2. Map extensions in `languages.ts`.
3. Add node-type handling in `parser.ts` and resolution rules in `resolve.ts`.
4. Add a fixture file and assertions in `tests/unit/parser.test.ts`.

## Troubleshooting

| Problem | Fix |
|---|---|
| `extension "vector" is not available` in tests | PGlite must be created with `{ extensions }` in the options object (see `lib/db/index.ts`) |
| Grammar fails with `getDylinkMetadata` | The `.wasm` was built for an older tree-sitter ABI; use the grammar package's own wasm |
| A page errors with "used `useParams()` outside of `<Suspense>`" | With Cache Components, client hooks that read the URL need a Suspense boundary (see `app/(workspace)/layout.tsx`) |
| GitHub import hits a rate limit | Set `GITHUB_TOKEN` (public-read fine-grained token) |
