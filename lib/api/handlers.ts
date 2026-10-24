import "server-only";

import type { NextRequest } from "next/server";
import { type ZodType, z } from "zod";

import { requireAdmin } from "@/lib/api/guards";
import { created, jsonError, ok, type ApiMeta } from "@/lib/api/response";
import { revalidateCacheTagsImmediately } from "@/lib/cache/revalidation";
import { logAdminRouteActivity } from "@/lib/services/admin-activity.service";
import { handleServiceError } from "@/lib/services/service-error";

/**
 * Shared wrappers for admin API routes.
 */

type AdminSession = Extract<
  Awaited<ReturnType<typeof requireAdmin>>,
  { ok: true }
>["session"];

/** Resolved params object after `await context.params`. */
export type ResolvedParams = Record<string, string | string[]>;

/** Next.js 15 route context — `params` is a Promise. */
type RouteContext<P extends ResolvedParams = ResolvedParams> = {
  params: Promise<P>;
};

/** A Prisma-style "not found" mapping: when `error.code === code`, return 404. */
export type NotFoundMapping = {
  /** Prisma error code, almost always `"P2025"`. */
  code: string;
  /** User-facing 404 message, e.g. `"Promo banner not found."`. */
  message: string;
};

/** Args passed to the user handler for a write route (with body). */
export type AdminJsonHandlerArgs<TBody, TParams extends ResolvedParams> = {
  body: TBody;
  params: TParams;
  request: NextRequest;
  session: AdminSession;
};

/** Args passed to the user handler for a read/delete route (no body). */
export type AdminHandlerArgs<TParams extends ResolvedParams> = {
  params: TParams;
  request: NextRequest;
  session: AdminSession;
};

/** What a user handler may return — we wrap raw data in `ok` / `created`. */
export type AdminHandlerResult<TData> =
  | { status?: 200; data: TData; meta?: ApiMeta }
  | { status: 201; data: TData }
  | { raw: Response };

type AdminJsonRouteOptions<
  TSchema extends ZodType,
  TParams extends ResolvedParams,
  TData,
> = {
  /** Zod schema applied to the parsed JSON body. */
  schema: TSchema;
  /** Scope string passed to `handleServiceError` — keep identical to the
   *  original hand-written route for log continuity. */
  scope: string;
  /** Cache tags to expire after a successful committed mutation. */
  revalidate?: readonly string[];
  /** Map a thrown error code (e.g. Prisma `P2025`) to a 404 response. */
  notFoundOn?: NotFoundMapping;
  /** The actual business logic. Receives validated body + resolved params. */
  handler: (
    args: AdminJsonHandlerArgs<z.infer<TSchema>, TParams>,
  ) => Promise<AdminHandlerResult<TData>>;
};

type AdminRouteOptions<TParams extends ResolvedParams, TData> = {
  scope: string;
  /** Optional Zod schema applied to `request.nextUrl.searchParams`. */
  querySchema?: ZodType;
  revalidate?: readonly string[];
  notFoundOn?: NotFoundMapping;
  handler: (
    args: AdminHandlerArgs<TParams> & { query?: unknown },
  ) => Promise<AdminHandlerResult<TData>>;
};

/** Type guard for Prisma `KnownRequestError`-shaped objects without
 *  importing Prisma here (keeps this module dependency-light). */
function hasErrorCode(err: unknown, code: string): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === code
  );
}

function envelope<TData>(result: AdminHandlerResult<TData>): Response {
  if ("raw" in result) return result.raw;
  if (result.status === 201) return created(result.data);
  return ok(result.data, result.meta);
}

/**
 * Build a JSON-body admin route handler (POST / PATCH / PUT).
 */
export function adminJsonRoute<
  TSchema extends ZodType,
  TData,
  TParams extends ResolvedParams = ResolvedParams,
>(options: AdminJsonRouteOptions<TSchema, TParams, TData>) {
  const { schema, scope, revalidate, notFoundOn, handler } = options;

  return async function routeHandler(
    request: NextRequest,
    context?: RouteContext<TParams>,
  ): Promise<Response> {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const params = (context ? await context.params : ({} as TParams));

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return jsonError(415, "Content-Type must be application/json.");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError(400, "Invalid JSON payload.");
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors = z.flattenError(parsed.error).fieldErrors;
      const messages = Object.values(fieldErrors)
        .flat()
        .filter((msg): msg is string => typeof msg === "string" && Boolean(msg.trim()));
      const errorMessage =
        messages.length > 0
          ? messages.join(". ")
          : "Missing or invalid required fields.";
      return jsonError(400, errorMessage, { fieldErrors });
    }

    try {
      const result = await handler({
        body: parsed.data,
        params,
        request,
        session: guard.session,
      });
      try {
        await logAdminRouteActivity({
          scope,
          method: request.method,
          actor: guard.session.user,
        });
      } catch (activityError) {
        console.error(`[${scope}] Activity logging failed after success`, activityError);
      }
      revalidateCacheTagsImmediately(revalidate);
      return envelope(result);
    } catch (error) {
      if (notFoundOn && hasErrorCode(error, notFoundOn.code)) {
        return jsonError(404, notFoundOn.message);
      }
      return handleServiceError(scope, error);
    }
  };
}

/**
 * Build a no-body admin route handler (GET / DELETE).
 */
export function adminRoute<
  TData,
  TParams extends ResolvedParams = ResolvedParams,
>(options: AdminRouteOptions<TParams, TData>) {
  const { scope, querySchema, revalidate, notFoundOn, handler } = options;

  return async function routeHandler(
    request: NextRequest,
    context?: RouteContext<TParams>,
  ): Promise<Response> {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const params = (context ? await context.params : ({} as TParams));

    let query: unknown;
    if (querySchema) {
      const raw = Object.fromEntries(request.nextUrl.searchParams);
      const parsed = querySchema.safeParse(raw);
      if (!parsed.success) {
        return jsonError(400, "Invalid query parameters.", {
          fieldErrors: z.flattenError(parsed.error).fieldErrors,
        });
      }
      query = parsed.data;
    }

    try {
      const result = await handler({
        params,
        request,
        session: guard.session,
        query,
      });
      try {
        await logAdminRouteActivity({
          scope,
          method: request.method,
          actor: guard.session.user,
        });
      } catch (activityError) {
        console.error(`[${scope}] Activity logging failed after success`, activityError);
      }
      revalidateCacheTagsImmediately(revalidate);
      return envelope(result);
    } catch (error) {
      if (notFoundOn && hasErrorCode(error, notFoundOn.code)) {
        return jsonError(404, notFoundOn.message);
      }
      return handleServiceError(scope, error);
    }
  };
}
