const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?$|\[?f[cd][0-9a-f]{2}:)/i;

/** Accepts only public http(s) URLs without embedded credentials; returns the normalized URL or null. */
export function safeExternalUrl(input: unknown): URL | null {
  if (typeof input !== "string" || input.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  if (!url.hostname.includes(".") || PRIVATE_HOST.test(url.hostname)) return null;
  return url;
}

export function displayDomain(url: URL) {
  return url.hostname.replace(/^www\./, "");
}
