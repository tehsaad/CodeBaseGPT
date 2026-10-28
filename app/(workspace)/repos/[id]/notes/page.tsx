import type { Metadata } from "next";
import { Suspense } from "react";
import { NotesView } from "@/components/notes/notes-view";
import { RequireReady } from "@/components/repos/require-ready";

// Per-user, client-gated content: there is no meaningful static shell to validate.
export const instant = false;

export const metadata: Metadata = { title: "Notes" };

export default function Page() {
  return (
    <RequireReady feature="Notes">
      <Suspense>
        <NotesView />
      </Suspense>
    </RequireReady>
  );
}
