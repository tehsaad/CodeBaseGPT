// Provider TEST DOUBLE: a minimal OpenAI-compatible /v1/chat/completions server that streams a
// canned answer slowly. Used only by playwright.provider.config.ts; never by the app itself.
import http from "node:http";

const PORT = Number(process.env.MOCK_LLM_PORT ?? 3299);
const ANSWER =
  "`signIn` looks the user up, checks the password with `verifyPassword`, and signs a session token [C1]. " +
  "It also mentions something that was not in the evidence [C99].\n\n**Inference:** a wrong password returns null rather than throwing.";

// Canned Code Tutor reply (detected from the tutor policy in the prompt) with a working fix for the
// default Python example, so the explain → fix → verify flow can be exercised end to end.
const TUTOR_ANSWER = [
  "## What happened",
  "The loop reads past the end of the list: `IndexError: list index out of range`.",
  "## Where it goes wrong",
  "line 4 uses `range(len(scores) + 1)`.",
  "## Why",
  "Indexes run from 0 to len - 1.",
  "## Hint",
  "How many items are there?",
  "## Fixed version",
  "```python",
  "scores = [72, 88, 95]",
  "",
  "total = 0",
  "for i in range(len(scores)):",
  "    total += scores[i]",
  "",
  'print("Average:", total / len(scores))',
  "```",
  "Removed the `+ 1`.",
  "## Check your understanding",
  "What is the last valid index?",
].join("\n");

http
  .createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") return res.end("ok");
    if (req.method !== "POST" || !req.url?.endsWith("/chat/completions")) {
      res.writeHead(404).end();
      return;
    }
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
      const answer = body.includes("Code Tutor") ? TUTOR_ANSWER : ANSWER;
      const words = answer.match(/\S+\s*|\n+/g) ?? [];
      const base = { id: "chatcmpl-mock", object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: "mock-gemma" };
      for (const w of words) {
        res.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: { content: w }, finish_reason: null }] })}\n\n`);
        await new Promise((r) => setTimeout(r, 90));
      }
      res.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 100, completion_tokens: words.length, total_tokens: 100 + words.length } })}\n\n`);
      res.end("data: [DONE]\n\n");
    });
  })
  .listen(PORT, "127.0.0.1", () => console.log(`mock LLM on ${PORT}`));
