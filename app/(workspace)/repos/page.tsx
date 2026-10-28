import type { Metadata } from "next";
import { Suspense } from "react";
import { RepoListPage } from "@/components/repos/repo-list";

export const metadata: Metadata = { title: "Repositories" };

export default function Page() {
  return (
    <Suspense>
      <RepoListPage />
    </Suspense>
  );
}
