# Web search (Student Stuck Mode)

`lib/search/provider.ts` implements two interchangeable providers behind one function, `webSearch(query)`:

| Provider | Variables | Endpoint |
|---|---|---|
| Tavily (default) | `SEARCH_PROVIDER=tavily`, `TAVILY_API_KEY` | `POST https://api.tavily.com/search` (basic depth) |
| Exa | `SEARCH_PROVIDER=exa`, `EXA_API_KEY` | `POST https://api.exa.ai/search` with highlights |

Requests are server-side only, with a 15 s timeout, at most 3 queries per Stuck request and 5–8 results. They're limited to 20 searches per 5 minutes per user.

## How queries are built

`lib/search/queries.ts` extracts an **error signature** from the pasted error (the most specific `XxxError: …`, `error TS1234`, `Cannot find module`, and so on). It then removes local paths, line numbers, memory addresses, **URLs, email addresses and token-like strings**, so private details never reach the search provider. Finally it adds the repository's language and its main runtime framework from `package.json`, Python requirements, or Maven/Gradle files. Students see the queries and can edit them before anything is sent.

## What's done with results

- URLs are validated: `http(s)` only, no embedded credentials, and no localhost or private IPs. Markup is stripped from titles and snippets, duplicates are removed, and official documentation domains are ranked slightly higher.
- Results are stored per user (`web_result`) and can be saved. They appear in History and Saved.
- In the explanation prompt, results are wrapped in `<web_sources>` and treated as untrusted data, so instructions inside them are ignored. Labels are `[W1]`…, and the UI links each one to the exact URL the provider returned.
- Snippets come from the provider. CodeBaseGPT does **not** fetch or scrape the pages, and says so in the UI.

## When search isn't available

Without a key, or when the provider fails or rate-limits, the web section shows the reason and the explanation proceeds with repository evidence only. No results are ever invented. This path is covered by integration and end-to-end tests.

## Verification status

The provider adapters are tested with injected responses (including unsafe URLs). **No live Tavily or Exa request was made while building**, because no key was available.
