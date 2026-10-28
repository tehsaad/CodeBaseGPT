import type { Metadata } from "next";
import { Suspense } from "react";
import { AskPage } from "@/components/chat/ask-page";
import { RequireReady } from "@/components/repos/require-ready";

// Per-user, client-gated content: there is no meaningful static shell to validate.
export const instant = false;

export const metadata: Metadata = { title: "Ask CodeBaseGPT" };

export default function Page() {
  return (
    <RequireReady feature="Ask CodeBaseGPT">
      <Suspense>
        <AskPage />
      </Suspense>
    </RequireReady>
  );
}
