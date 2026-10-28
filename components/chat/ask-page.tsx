"use client";
import { useSearchParams } from "next/navigation";
import { ChatView } from "./chat-view";

/** Re-mounts the chat when switching conversations so each has its own message state. */
export function AskPage() {
  const params = useSearchParams();
  const c = params.get("c");
  const focusKey = `${params.get("file") ?? ""}-${params.get("symbol") ?? ""}-${params.get("start") ?? ""}`;
  return <ChatView key={c ? `c-${c}` : `new-${focusKey}`} />;
}
