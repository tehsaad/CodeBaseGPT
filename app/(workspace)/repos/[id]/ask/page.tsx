import type { Metadata } from "next";
import { Suspense } from "react";
import { AskPage } from "@/components/chat/ask-page";
import { RequireReady } from "@/components/repos/require-ready";

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
