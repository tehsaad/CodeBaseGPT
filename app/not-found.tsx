import { Compass } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-sm text-center">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <Compass className="mx-auto size-8 text-fg-subtle" aria-hidden />
        <h1 className="mt-3 text-xl font-semibold">This page isn&apos;t in the index</h1>
        <p className="mt-1 text-sm text-fg-muted">The link may be outdated, or the resource belongs to another account.</p>
        <div className="mt-6 flex justify-center gap-2">
          <ButtonLink href="/dashboard" variant="primary">Go to overview</ButtonLink>
          <ButtonLink href="/">Home</ButtonLink>
        </div>
      </div>
    </div>
  );
}
