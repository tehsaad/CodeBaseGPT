import type { Metadata } from "next";
import { Suspense } from "react";
import { HistoryPage } from "@/components/library/history";

export const metadata: Metadata = { title: "History" };

export default function Page() {
  return (
    <Suspense>
      <HistoryPage />
    </Suspense>
  );
}
