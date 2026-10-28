import type { Metadata } from "next";
import { Suspense } from "react";
import { SourceBrowser } from "@/components/source/source-browser";

// Per-user, client-gated content: there is no meaningful static shell to validate.
export const instant = false;

export const metadata: Metadata = { title: "Source" };

export default function Page() {
  return (
    <Suspense>
      <SourceBrowser />
    </Suspense>
  );
}
