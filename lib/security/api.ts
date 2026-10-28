import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { getUserFromHeaders, type SessionUser } from "@/lib/auth/session";
import { log } from "@/lib/observability/log";

export type ErrorCode =
  | "unauthorized"
  | "not_found"
  | "invalid_request"
  | "rate_limited"
  | "conflict"
  | "payload_too_large"
  | "provider_not_configured"
  | "provider_error"
  | "upstream_error"
  | "internal_error";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function errorResponse(status: number, code: ErrorCode, message: string, details?: Record<string, unknown>) {
  return NextResponse.json({ error: { code, message, ...(details ? { details } : {}) } }, { status });
}

export function parseBody<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ApiError(400, "invalid_request", issue ? `${issue.path.join(".") || "body"}: ${issue.message}` : "Invalid request");
  }
  return result.data;
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, "invalid_request", "Request body must be valid JSON");
  }
}

type Handler<C> = (req: Request, ctx: { user: SessionUser; params: C }) => Promise<Response>;

/** Wraps a route handler: requires a valid session, maps ApiErrors, and hides internal failures. */
export function withUser<C = Record<string, never>>(handler: Handler<C>) {
  return async (req: Request, routeCtx: { params: Promise<C> }) => {
    try {
      const user = await getUserFromHeaders(req.headers);
      if (!user) return errorResponse(401, "unauthorized", "Sign in to continue");
      const params = routeCtx?.params ? await routeCtx.params : ({} as C);
      return await handler(req, { user, params });
    } catch (error) {
      if (error instanceof ApiError) return errorResponse(error.status, error.code, error.message, error.details);
      log("error", "api.unhandled", { path: new URL(req.url).pathname, error });
      return errorResponse(500, "internal_error", "Something went wrong on our side. Please try again.");
    }
  };
}
