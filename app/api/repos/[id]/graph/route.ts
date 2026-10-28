import { NextResponse } from "next/server";
import { z } from "zod";
import { buildGraph } from "@/lib/repos/graph";
import { requireOwnedRepository } from "@/lib/security/access";
import { parseBody, withUser } from "@/lib/security/api";

const Query = z.object({
  mode: z.enum(["architecture", "dependencies", "symbols"]).default("architecture"),
  expanded: z.string().max(4000).optional(),
  dir: z.string().max(500).optional(),
  language: z.string().max(40).optional(),
  symbolKind: z.enum(["function", "method", "class", "interface", "type", "enum", "struct", "namespace"]).optional(),
  fileId: z.uuid().optional(),
  external: z.enum(["0", "1"]).optional(),
});

export const GET = withUser<{ id: string }>(async (req, { user, params }) => {
  const repo = await requireOwnedRepository(user.id, params.id);
  const q = parseBody(Query, Object.fromEntries(new URL(req.url).searchParams));
  const graph = await buildGraph(repo.id, {
    mode: q.mode,
    expanded: q.expanded ? q.expanded.split(",").filter(Boolean).slice(0, 100) : [],
    dir: q.dir || undefined,
    language: q.language || undefined,
    symbolKind: q.symbolKind,
    fileId: q.fileId,
    includeExternal: q.external === "1",
  });
  return NextResponse.json(graph);
});
