import { spawn } from "node:child_process";
import { resolve } from "node:path";
import {
  parseWrinkleLine,
  type WrinkleLine,
} from "@/src/lib/scanDetectionRegions";
import { logger } from "@/services/shared/src/logging";

const SCRIPT = resolve(
  process.cwd(),
  "apps/ml-worker/python/extract_wrinkle_lines.py"
);

const TIMEOUT_MS = 25_000;

function pythonBin(): string {
  return (
    process.env.WRINKLE_LINES_PYTHON?.trim() ||
    process.env.CAPTURE_PREVIEW_PYTHON?.trim() ||
    "python3"
  );
}

function stderrSnippet(stderr: string | undefined): string | undefined {
  const s = stderr?.trim();
  if (!s) return undefined;
  return s.slice(0, 300);
}

/** Strip `data:image/...;base64,` prefix when present. */
export function jpegDataUriOrB64ToRawB64(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  const m = /^data:image\/[a-zA-Z0-9+.-]+;base64,(.+)$/.exec(s);
  if (m?.[1]) return m[1];
  // Already raw base64
  if (/^[A-Za-z0-9+/=\s]+$/.test(s) && s.length > 32) return s.replace(/\s+/g, "");
  return null;
}

export async function bufferToJpegB64(buf: Buffer | Uint8Array): Promise<string> {
  return Buffer.from(buf).toString("base64");
}

export async function fileToJpegB64(file: File): Promise<string> {
  const ab = await file.arrayBuffer();
  return Buffer.from(ab).toString("base64");
}

/**
 * Run local OpenCV wrinkle-line extraction.
 * Returns [] on failure (scan continues without polylines).
 */
export async function extractWrinkleLinesFromImages(input: {
  wrinkleMaskDataUriOrB64: string;
  sourceJpegB64: string;
  timeoutMs?: number;
}): Promise<WrinkleLine[]> {
  const maskB64 = jpegDataUriOrB64ToRawB64(input.wrinkleMaskDataUriOrB64);
  const sourceB64 = jpegDataUriOrB64ToRawB64(input.sourceJpegB64);
  if (!maskB64 || !sourceB64) return [];

  try {
    const raw = await execExtract({
      mask_b64: maskB64,
      source_b64: sourceB64,
      timeoutMs: input.timeoutMs ?? TIMEOUT_MS,
    });
    if (!raw || raw.ok === false) {
      logger.warn("wrinkle_lines_python_failed", {
        error: raw?.error ?? "no output",
        stderr: stderrSnippet(raw?.stderr),
      });
      return [];
    }
    const list = Array.isArray(raw.wrinkle_lines) ? raw.wrinkle_lines : [];
    const out: WrinkleLine[] = [];
    for (const item of list) {
      const parsed = parseWrinkleLine(item);
      if (parsed) out.push(parsed);
    }
    return out;
  } catch (err) {
    logger.warn("wrinkle_lines_spawn_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

type WrinkleExtractResult = {
  ok?: boolean;
  wrinkle_lines?: unknown;
  error?: string;
  stderr?: string;
};

function execExtract(payload: {
  mask_b64: string;
  source_b64: string;
  timeoutMs: number;
}): Promise<WrinkleExtractResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(pythonBin(), [SCRIPT], {
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(
        new Error(
          `wrinkle line extraction timed out${
            stderr.trim() ? `: ${stderr.trim().slice(0, 300)}` : ""
          }`
        )
      );
    }, payload.timeoutMs);

    child.stdout.on("data", (c: Buffer) => {
      stdout += c.toString();
    });
    child.stderr.on("data", (c: Buffer) => {
      stderr += c.toString();
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0 && !stdout.trim()) {
        reject(
          new Error(
            stderr.trim() || `extract_wrinkle_lines exited with code ${code}`
          )
        );
        return;
      }
      const line = stdout.trim().split("\n").pop() || "{}";
      try {
        const parsed = JSON.parse(line) as WrinkleExtractResult;
        resolvePromise({ ...parsed, stderr });
      } catch {
        reject(
          new Error(
            `invalid wrinkle_lines JSON: ${line.slice(0, 200)}${
              stderr.trim() ? ` | stderr: ${stderr.trim().slice(0, 300)}` : ""
            }`
          )
        );
      }
    });

    child.stdin.write(
      JSON.stringify({
        mask_b64: payload.mask_b64,
        source_b64: payload.source_b64,
      })
    );
    child.stdin.end();
  });
}
