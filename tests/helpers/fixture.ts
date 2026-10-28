import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { zipSync, strToU8 } from "fflate";

export const FIXTURE_DIR = path.join(import.meta.dirname, "..", "fixtures", "sample-repo");

/** Secret files are added at runtime because the repo's .gitignore (correctly) refuses to commit them. */
export const INJECTED_SECRETS: Record<string, string> = {
  ".env": "SESSION_SECRET=super-secret-value\nDATABASE_URL=postgres://user:pass@host/db\n",
  "config/deploy_key.txt": "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAfake\n-----END RSA PRIVATE KEY-----\n",
  "src/config.ts": 'export const GITHUB_TOKEN = "ghp_abcdefghijklmnopqrstuvwxyz0123456789AB";\n',
};

function walk(dir: string, base = ""): Record<string, Uint8Array> {
  const out: Record<string, Uint8Array> = {};
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    if (statSync(full).isDirectory()) Object.assign(out, walk(full, rel));
    else out[rel] = new Uint8Array(readFileSync(full));
  }
  return out;
}

export function fixtureFiles(): Record<string, Uint8Array> {
  const files = walk(FIXTURE_DIR);
  for (const [p, c] of Object.entries(INJECTED_SECRETS)) files[p] = strToU8(c);
  files["assets/logo.png"] = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
  return files;
}

/** Builds a ZIP shaped like a GitHub zipball (single top-level folder). */
export function fixtureZip(prefix = "demo-taskboard-abc123/"): Uint8Array {
  const files = fixtureFiles();
  const entries: Record<string, Uint8Array> = {};
  for (const [p, c] of Object.entries(files)) entries[prefix + p] = c;
  return zipSync(entries);
}
