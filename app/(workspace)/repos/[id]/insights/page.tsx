import type { Metadata } from "next";
import { InsightsView } from "@/components/insights/insights-view";
import { RequireReady } from "@/components/repos/require-ready";

export const metadata: Metadata = { title: "Insights" };

export default function Page() {
  return (
    <RequireReady feature="Insights">
      <InsightsView />
    </RequireReady>
  );
}
