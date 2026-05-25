/**
 * Structured logging — prepare for CloudWatch / Sentry without integrating yet.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

export interface LogSink {
  write(level: LogLevel, message: string, context?: LogContext): void;
}

class ConsoleLogSink implements LogSink {
  write(level: LogLevel, message: string, context?: LogContext): void {
    const line = {
      ts: new Date().toISOString(),
      level,
      message,
      ...(context && Object.keys(context).length ? { context } : {}),
    };
    const fn =
      level === "error"
        ? console.error
        : level === "warn"
          ? console.warn
          : console.log;
    fn(JSON.stringify(line));
  }
}

let sink: LogSink = new ConsoleLogSink();

export function setLogSink(next: LogSink): void {
  sink = next;
}

function log(level: LogLevel, message: string, context?: LogContext): void {
  sink.write(level, message, context);
}

export const logger = {
  debug: (message: string, context?: LogContext) => log("debug", message, context),
  info: (message: string, context?: LogContext) => log("info", message, context),
  warn: (message: string, context?: LogContext) => log("warn", message, context),
  error: (message: string, context?: LogContext) => log("error", message, context),
  request: (method: string, path: string, context?: LogContext) =>
    log("info", "http_request", { method, path, ...context }),
  queue: (queue: string, event: string, context?: LogContext) =>
    log("info", "queue_event", { queue, event, ...context }),
  inference: (ms: number, context?: LogContext) =>
    log("info", "inference_timing", { durationMs: ms, ...context }),
  dbError: (operation: string, err: unknown) =>
    log("error", "db_error", {
      operation,
      error: err instanceof Error ? err.message : String(err),
    }),
};
