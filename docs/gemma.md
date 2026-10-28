# Gemma provider

All model calls happen server-side in `lib/ai/provider.ts`. The browser never sees a key, and the model ID and endpoint come only from environment variables.

## Option A: Google AI Studio / Gemini API (`GEMMA_PROVIDER=google`)

```bash
GEMMA_PROVIDER=google
GEMMA_MODEL=gemma-3-27b-it
GEMMA_API_KEY=...            # https://aistudio.google.com/apikey
GEMMA_CONTEXT_TOKENS=32000   # optional prompt budget (Gemma 3 supports up to 128K)
```

The installed `@ai-sdk/google` (v4.0.107) lists these Gemma IDs: `gemma-3-27b-it`, `gemma-3-12b-it`, `gemma-3-4b-it`, `gemma-3-1b-it`, `gemma-3n-e4b-it` and `gemma-3n-e2b-it`. Availability depends on your key and region. Check it with:

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMMA_API_KEY" | grep -o '"name": "models/gemma[^"]*"'
```

The Gemini API rejects system instructions for Gemma models. CodeBaseGPT detects `gemma*` model IDs and moves its policy into the first user turn, inside `<instructions>` tags. A test covers this.

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
- Timeouts: 30 s to the first token and 90 s in total, with one retry and up to 1,600 output tokens.
- If no code matches the question, the model is **not called**.

## Verification status

The adapter, prompt construction, streaming, citation validation, and error paths are tested with the AI SDK's `MockLanguageModelV4`. **No live Gemma request was made while building**, because no API key was available. After setting the variables, check `GET /api/status` and ask one question to confirm.
