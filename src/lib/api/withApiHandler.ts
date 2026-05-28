import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/src/lib/infra";

export type ApiHandler = (
  request: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => Promise<NextResponse>;

/** Structured request logging + consistent error envelope. */
export function withApiHandler(
  name: string,
  handler: ApiHandler
): ApiHandler {
  return async (request, context) => {
    const started = Date.now();
    logger.request(request.method, name);
    try {
      const res = await handler(request, context);
      logger.info("api_ok", {
        name,
        status: res.status,
        durationMs: Date.now() - started,
      });
      return res;
    } catch (err) {
      logger.error("api_error", {
        name,
        durationMs: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      });
      const dev = process.env.NODE_ENV === "development";
      return NextResponse.json(
        {
          success: false,
          error: dev && err instanceof Error ? err.message : "Internal error",
        },
        { status: 500 }
      );
    }
  };
}
