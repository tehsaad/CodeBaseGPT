"use client";
import { FileArchive, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { api, ClientApiError, type Repository } from "@/lib/client/api";
import { GitHubIcon } from "@/components/brand/github-icon";
import { cn } from "@/lib/client/cn";
import { bytes } from "@/lib/client/format";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/misc";

const MAX_ZIP = 4 * 1024 * 1024;

export function ImportForm({ onImported, next }: { onImported?: () => void; next?: string }) {
  const [tab, setTab] = useState<"github" | "zip">("github");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      let res: { repository: Repository; existing: boolean };
      if (tab === "github") {
        res = await api("/api/repos", { method: "POST", body: JSON.stringify({ source: "github", url: url.trim() }) });
      } else {
        if (!file) throw new ClientApiError(400, "invalid_request", "Choose a .zip file first");
        const form = new FormData();
        form.append("file", file);
        res = await api("/api/repos", { method: "POST", body: form });
      }
      onImported?.();
      router.push(`/repos/${res.repository.id}${next ? `/${next}` : ""}`);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Import failed. Please try again.");
      setLoading(false);
    }
  }

  const tabCls = (active: boolean) =>
    cn("flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors max-md:py-2.5", active ? "bg-surface-3 text-fg" : "text-fg-muted hover:text-fg");

  return (
    <form onSubmit={submit} className="space-y-4">
      <div role="tablist" aria-label="Import source" className="flex gap-1 rounded-lg border border-border bg-surface-2 p-1">
        <button type="button" role="tab" aria-selected={tab === "github"} className={tabCls(tab === "github")} onClick={() => setTab("github")}>
          <GitHubIcon /> GitHub
        </button>
        <button type="button" role="tab" aria-selected={tab === "zip"} className={tabCls(tab === "zip")} onClick={() => setTab("zip")}>
          <FileArchive className="size-4" aria-hidden /> ZIP upload
        </button>
      </div>

      {tab === "github" ? (
        <Field label="Repository" hint="owner/name, a github.com URL, or owner/name@branch. Public repositories work without connecting GitHub.">
          {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} placeholder="e.g. tehsaad/CodeBaseGPT" value={url} onChange={(e) => setUrl(e.target.value)} autoComplete="off" spellCheck={false} className="font-mono" />}
        </Field>
      ) : (
        <div className="space-y-1.5">
          <span className="block text-[13px] font-medium">Archive</span>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) setFile(f);
            }}
            className="flex w-full cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed border-border-strong bg-surface-2 px-4 py-6 text-sm text-fg-muted hover:border-primary hover:text-fg"
          >
            <Upload className="size-5" aria-hidden />
            {file ? (
              <span className="font-mono text-fg">
                {file.name} · {bytes(file.size)}
              </span>
            ) : (
              <span>Drop a .zip here or click to choose</span>
            )}
            <span className="text-xs text-fg-subtle">Up to 4 MB. Nothing in the archive is executed.</span>
          </button>
          <input ref={inputRef} type="file" accept=".zip,application/zip" className="sr-only" aria-label="ZIP archive" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {file && file.size > MAX_ZIP ? <p className="text-xs text-danger">This file is larger than 4 MB. Import it from GitHub instead.</p> : null}
        </div>
      )}

      <p className="text-xs text-fg-muted">
        Dependencies, build output, binaries, lockfiles, <span className="font-mono">.env</span> files and private keys are skipped; recognizable tokens are redacted before storage.
      </p>
      {error ? <Notice tone="danger" title={error} /> : null}
      <Button type="submit" variant="primary" loading={loading} disabled={tab === "github" ? url.trim().length < 3 : !file || file.size > MAX_ZIP}>
        {loading ? (tab === "github" ? "Downloading repository…" : "Uploading…") : "Import and index"}
      </Button>
    </form>
  );
}
