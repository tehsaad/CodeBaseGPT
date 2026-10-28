import { CheckCircle2, CircleDashed, Loader2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/misc";
import type { Repository } from "@/lib/client/api";

const LABEL: Record<Repository["status"], string> = {
  queued: "Queued",
  downloading: "Downloading",
  parsing: "Parsing",
  linking: "Linking",
  ready: "Indexed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function isIndexing(status: Repository["status"]) {
  return status === "queued" || status === "downloading" || status === "parsing" || status === "linking";
}

export function RepoStatusBadge({ status }: { status: Repository["status"] }) {
  if (status === "ready")
    return (
      <Badge tone="success">
        <CheckCircle2 className="size-3" aria-hidden /> {LABEL[status]}
      </Badge>
    );
  if (status === "failed")
    return (
      <Badge tone="danger">
        <XCircle className="size-3" aria-hidden /> {LABEL[status]}
      </Badge>
    );
  if (status === "cancelled")
    return (
      <Badge>
        <CircleDashed className="size-3" aria-hidden /> {LABEL[status]}
      </Badge>
    );
  return (
    <Badge tone="primary">
      <Loader2 className="size-3 animate-spin" aria-hidden /> {LABEL[status]}
    </Badge>
  );
}
