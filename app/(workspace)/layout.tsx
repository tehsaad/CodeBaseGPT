import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { Skeleton } from "@/components/ui/misc";

function ShellFallback() {
  return (
    <div className="flex min-h-dvh">
      <div className="hidden w-[248px] shrink-0 border-r border-border bg-surface lg:block" />
      <div className="flex-1 space-y-3 p-6">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-40" />
      </div>
    </div>
  );
}

/** Everything under the workspace is per-user, so it streams in behind one boundary. */
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
