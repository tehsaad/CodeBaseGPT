import { Suspense } from "react";
import { RepoLayout } from "@/components/repos/repo-layout";
import { Skeleton } from "@/components/ui/misc";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="space-y-3 p-6"><Skeleton className="h-6 w-72" /><Skeleton className="h-64" /></div>}>
      <RepoLayout>{children}</RepoLayout>
    </Suspense>
  );
}
