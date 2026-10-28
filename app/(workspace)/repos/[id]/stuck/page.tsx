import type { Metadata } from "next";
import { Suspense } from "react";
import { RequireReady } from "@/components/repos/require-ready";
import { StuckView } from "@/components/stuck/stuck-view";

export const metadata: Metadata = { title: "I'm stuck" };

export default function Page() {
  return (
    <RequireReady feature="Stuck Mode">
      <Suspense>
        <StuckView />
      </Suspense>
    </RequireReady>
  );
}
