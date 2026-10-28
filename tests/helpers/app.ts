import { MockLanguageModelV4 } from "ai/test";
import { simulateReadableStream } from "ai";
import * as authRoute from "@/app/api/auth/[...all]/route";
import { setModelOverrideForTests } from "@/lib/ai/provider";

const BASE = "http://localhost:3000";

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

export async function signUp(email: string, password = "correct-horse-battery") {
  const res = await authRoute.POST(
    new Request(`${BASE}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE },
      body: JSON.stringify({ email, password, name: email.split("@")[0] }),
    }),
  );
  if (res.status !== 200) throw new Error(`sign-up failed ${res.status}: ${await res.text()}`);
  return cookieFrom(res);
}

export function cookieFrom(res: Response) {
  return res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

export async function call(
  handler: Handler,
  path: string,
  opts: { cookie?: string; method?: string; json?: unknown; form?: FormData; params?: Record<string, string> } = {},
) {
  const headers: Record<string, string> = { origin: BASE };
  if (opts.cookie) headers.cookie = opts.cookie;
  let body: BodyInit | undefined;
  if (opts.json !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(opts.json);
  } else if (opts.form) body = opts.form;
  const req = new Request(`${BASE}${path}`, { method: opts.method ?? (body ? "POST" : "GET"), headers, body });
  return handler(req, { params: Promise.resolve(opts.params ?? {}) });
}

/** Parses an AI SDK UI message stream (SSE) into its JSON chunks. */
export async function readUIStream(res: Response) {
  const text = await res.text();
  return text
    .split("\n")
    .filter((l) => l.startsWith("data: ") && l !== "data: [DONE]")
    .map((l) => JSON.parse(l.slice(6)) as { type: string; data?: any; delta?: string; errorText?: string });
}

export function streamedText(chunks: { type: string; delta?: string }[]) {
  return chunks.filter((c) => c.type === "text-delta").map((c) => c.delta).join("");
}

const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 10, text: 10, reasoning: undefined } };

/** Installs a mock Gemma that streams `reply` and records the prompts it was given. */
export function mockGemma(reply: string | (() => never), opts: { supportsSystemRole?: boolean } = {}) {
  const model = new MockLanguageModelV4({
    doStream: async () => {
      if (typeof reply === "function") reply();
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: "text-start", id: "t1" },
            ...(reply as string).match(/.{1,20}/gs)!.map((delta) => ({ type: "text-delta" as const, id: "t1", delta })),
            { type: "text-end", id: "t1" },
            { type: "finish", finishReason: { unified: "stop", raw: undefined }, logprobs: undefined, usage },
          ],
        }),
      };
    },
  });
  setModelOverrideForTests({ model, label: "gemma-test via mock", modelId: "gemma-test", supportsSystemRole: opts.supportsSystemRole ?? false, contextTokens: 32_000 });
  return model;
}

export function clearGemma() {
  setModelOverrideForTests(null);
}
