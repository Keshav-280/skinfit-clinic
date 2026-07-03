/** Structured logs for Medixora → kAI report pipeline. Grep: `[skinfit-report]` */

const PREFIX = "[skinfit-report]";

export function isReportPipelineDebug(): boolean {
  const v = process.env.SKINFIT_REPORT_DEBUG?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

type LogPayload = Record<string, unknown>;

function write(stage: string, payload: LogPayload = {}): void {
  console.log(
    `${PREFIX} ${JSON.stringify({
      ts: new Date().toISOString(),
      stage,
      ...payload,
    })}`
  );
}

/** Always emitted — key pipeline milestones (no full PDF text). */
export function reportLog(stage: string, payload: LogPayload = {}): void {
  write(stage, payload);
}

/** Verbose detail (parsed text snippets, metric lists) when SKINFIT_REPORT_DEBUG=1. */
export function reportDebug(stage: string, payload: LogPayload = {}): void {
  if (!isReportPipelineDebug()) return;
  write(stage, { debug: true, ...payload });
}

export function reportError(stage: string, err: unknown, payload: LogPayload = {}): void {
  console.error(
    `${PREFIX} ${JSON.stringify({
      ts: new Date().toISOString(),
      stage,
      level: "error",
      error: err instanceof Error ? err.message : String(err),
      ...payload,
    })}`
  );
}

export function truncateText(text: string, max = 600): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max)}…`;
}
