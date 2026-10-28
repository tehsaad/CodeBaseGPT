import type { Metadata } from "next";
import { Suspense } from "react";
import { AtlasView } from "@/components/atlas/atlas-view";
import { RequireReady } from "@/components/repos/require-ready";

// Per-user, client-gated content: there is no meaningful static shell to validate.
export const instant = false;

export const metadata: Metadata = { title: "Codebase Atlas" };

export default function Page() {
  return (
    <RequireReady feature="The Atlas">
      <Suspense>
        <AtlasView />
      </Suspense>
    </RequireReady>
  );
}
