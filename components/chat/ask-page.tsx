"use client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ChatView } from "./chat-view";

/**
 * Remounts the chat only when the user switches conversations or focus explicitly. When the chat
 * itself writes the new conversation id into the URL mid-stream, the mounted view is kept so the
 * streaming answer isn't lost.
 */
export function AskPage() {
  const params = useSearchParams();
  const c = params.get("c");
  const focusKey = `${params.get("file") ?? ""}-${params.get("symbol") ?? ""}-${params.get("start") ?? ""}`;
  const [own, setOwn] = useState<string | null>(null);
  const [seen, setSeen] = useState({ c, focusKey });
  const [generation, setGeneration] = useState(0);
  if (seen.c !== c || seen.focusKey !== focusKey) {
    setSeen({ c, focusKey });
    const selfAssigned = c !== null && c === own && seen.focusKey === focusKey;
    if (!selfAssigned) setGeneration((g) => g + 1);
  }
  return <ChatView key={generation} onConversationAssigned={setOwn} />;
}
