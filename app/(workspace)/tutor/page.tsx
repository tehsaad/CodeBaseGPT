import type { Metadata } from "next";
import { Suspense } from "react";
import { TutorView } from "@/components/tutor/tutor-view";

export const metadata: Metadata = { title: "Code Tutor" };

export default function Page() {
  return (
    <div className="flex min-h-dvh flex-col max-lg:min-h-[calc(100dvh-3.5rem)]">
      <div className="border-b border-border px-4 py-3 sm:px-6">
        <h1 className="text-lg font-semibold tracking-tight">Code Tutor</h1>
        <p className="text-[13px] text-fg-muted">Run small programs safely, see the real output, and let the tutor explain what went wrong — line by line.</p>
      </div>
      <Suspense>
        <TutorView />
      </Suspense>
    </div>
  );
}
