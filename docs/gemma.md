# Gemma provider

All model calls happen server-side in `lib/ai/provider.ts`. The browser never sees a key, and the model ID and endpoint come only from environment variables.

## Option A: Google AI Studio / Gemini API (`GEMMA_PROVIDER=google`)

```bash
GEMMA_PROVIDER=google
GEMMA_MODEL=gemma-4-26b-a4b-it
GEMMA_API_KEY=...            # https://aistudio.google.com/apikey
GEMMA_CONTEXT_TOKENS=32000   # optional prompt budget (Gemma 3 supports up to 128K)
```

Availability depends on your key. On 2026-10-28 the project's key listed `gemma-4-31b-it` and **`gemma-4-26b-a4b-it`** (used in production: in a reliability check the 31B model failed 2 of 3 calls with `500 INTERNAL`, the 26B-A4B model succeeded 3 of 3); older keys may list Gemma 3 IDs (`gemma-3-27b-it`, …). Check yours with:

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMMA_API_KEY" | grep -o '"name": "models/gemma[^"]*"'
```

Gemma 1–3 on the Gemini API reject system instructions, so for those IDs CodeBaseGPT moves its policy into the first user turn inside `<instructions>` tags (covered by a test). Gemma 4 accepts system instructions and uses them. Hosted Gemma 4 occasionally returns `500 INTERNAL`, so Google calls retry up to 3 times. Gemma 4 always reasons before answering (about 700 hidden tokens in our checks) and rejects `thinkingBudget`/`thinkingLevel`, so its output budget defaults to 6,144 tokens. Override it with `GEMMA_MAX_OUTPUT_TOKENS`.

## Option B: any OpenAI-compatible endpoint (`GEMMA_PROVIDER=openai-compatible`)

Use this for self-hosted Gemma (vLLM, TGI, LM Studio, or Ollama exposed over HTTPS), or a hosted provider that serves Gemma through an OpenAI-style API.

```bash
GEMMA_PROVIDER=openai-compatible
GEMMA_BASE_URL=https://gemma.example.com/v1
GEMMA_MODEL=google/gemma-3-27b-it   # whatever name your server exposes
GEMMA_API_KEY=...                   # if your endpoint needs one
```

**Ollama on your laptop is not reachable from Vercel.** Running `localhost:11434` works only for local development. For a deployed demo, expose a remote endpoint (behind authentication) or use option A.

## Honesty guarantees

- The model label (`<model> via <provider>`) is shown on every answer, so there is no silent substitution.
- If the provider isn't configured, the response says so and lists the retrieved code locations. No answer text is generated.
- Errors are mapped to clear messages (timeout, 429, invalid key, unknown model) and saved as failed messages. Nothing is fabricated after a failure.
- Timeouts: 30 s to the first token and 90 s in total. Retries: 3 for Google, 1 otherwise. Output budget: 6,144 tokens for Gemma 4, 1,600 otherwise.
- If no code matches the question, the model is **not called**.

## Verification status

The adapter, prompt construction, streaming, citation validation, and error paths are tested with the AI SDK's `MockLanguageModelV4`. **No live Gemma request was made while building**, because no API key was available. After setting the variables, check `GET /api/status` and ask one question to confirm.
