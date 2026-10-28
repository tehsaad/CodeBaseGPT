import type { Metadata } from "next";
import { Suspense } from "react";
import { LearnView } from "@/components/learn/learn-view";
import { RequireReady } from "@/components/repos/require-ready";

// Per-user, client-gated content: there is no meaningful static shell to validate.
export const instant = false;

export const metadata: Metadata = { title: "Learning path" };

export default function Page() {
  return (
    <RequireReady feature="The learning path">
      <Suspense>
        <LearnView />
      </Suspense>
    </RequireReady>
  );
}
