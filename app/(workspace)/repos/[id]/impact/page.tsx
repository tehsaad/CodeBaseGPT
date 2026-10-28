import type { Metadata } from "next";
import { Suspense } from "react";
import { ImpactView } from "@/components/impact/impact-view";
import { RequireReady } from "@/components/repos/require-ready";

// Per-user, client-gated content: there is no meaningful static shell to validate.
export const instant = false;

export const metadata: Metadata = { title: "Change impact" };

export default function Page() {
  return (
    <RequireReady feature="Impact analysis">
      <Suspense>
        <ImpactView />
      </Suspense>
    </RequireReady>
  );
}
