import type { Metadata } from "next";
import { InsightsView } from "@/components/insights/insights-view";
import { RequireReady } from "@/components/repos/require-ready";

// Per-user, client-gated content: there is no meaningful static shell to validate.
export const instant = false;

export const metadata: Metadata = { title: "Insights" };

export default function Page() {
  return (
    <RequireReady feature="Insights">
      <InsightsView />
    </RequireReady>
  );
}
