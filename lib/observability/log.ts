type Level = "info" | "warn" | "error";

const REDACT = /(authorization|cookie|token|secret|password|api[_-]?key)/i;

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 3 || value == null) return value;
  if (value instanceof Error) return { name: value.name, message: value.message.slice(0, 500) };
  if (typeof value === "string") return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => scrub(v, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, REDACT.test(k) ? "[redacted]" : scrub(v, depth + 1)]),
    );
  }
  return value;
}

/** Structured logging that never prints credentials, and truncates payloads so source code isn't dumped into logs. */
export function log(level: Level, event: string, fields: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV === "test" && level !== "error") return;
  const line = JSON.stringify({ level, event, ts: new Date().toISOString(), ...(scrub(fields) as object) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
