import { toNextJsHandler } from "better-auth/next-js";
import { getDb } from "@/lib/db";
import { getAuth } from "@/lib/auth";

async function handle(req: Request) {
  await getDb();
  const { GET, POST } = toNextJsHandler(getAuth());
  return req.method === "GET" ? GET(req) : POST(req);
}

export const GET = handle;
export const POST = handle;
