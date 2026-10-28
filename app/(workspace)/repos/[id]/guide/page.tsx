import type { Metadata } from "next";
import { GuideView } from "@/components/guide/guide-view";
import { RequireReady } from "@/components/repos/require-ready";

// Per-user, client-gated content: there is no meaningful static shell to validate.
export const instant = false;

export const metadata: Metadata = { title: "Codebase guide" };

export default function Page() {
  return (
    <RequireReady feature="The codebase guide">
      <GuideView />
    </RequireReady>
  );
}
