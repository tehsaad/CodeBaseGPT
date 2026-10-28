// Per-user, client-gated content: there is no meaningful static shell to validate.
export const instant = false;

import { RepoOverview } from "@/components/repos/repo-overview";

export default function Page() {
  return <RepoOverview />;
}
