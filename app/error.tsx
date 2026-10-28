"use client";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";

export default function ErrorPage({ reset, error }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid min-h-[60dvh] place-items-center px-4">
      <div className="max-w-sm text-center">
        <TriangleAlert className="mx-auto size-8 text-warning" aria-hidden />
        <h1 className="mt-3 text-xl font-semibold">Something went wrong</h1>
        <p className="mt-1 text-sm text-fg-muted">The page hit an unexpected error. Your data is safe.{error.digest ? <> Reference <span className="font-mono">{error.digest}</span>.</> : null}</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="primary" onClick={reset}><RotateCcw /> Try again</Button>
          <ButtonLink href="/dashboard">Overview</ButtonLink>
        </div>
      </div>
    </div>
  );
}
