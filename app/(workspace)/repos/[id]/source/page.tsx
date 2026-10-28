import type { Metadata } from "next";
import { Suspense } from "react";
import { SourceBrowser } from "@/components/source/source-browser";

export const metadata: Metadata = { title: "Source" };

export default function Page() {
  return (
    <Suspense>
      <SourceBrowser />
    </Suspense>
  );
}
