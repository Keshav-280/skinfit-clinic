import { spawn } from "node:child_process";
import { resolve } from "node:path";

import { getServerFaceCaptureConfig } from "@/src/lib/faceCaptureConfig";
import type { FacePreviewInferenceResult } from "@/src/lib/faceCaptureTypes";

const SCRIPT = resolve(
  process.cwd(),
  "apps/ml-worker/python/face_preview_infer.py"
);

const TIMEOUT_MS = 12_000;

export async function runFacePreviewInference(
  jpeg: Buffer
): Promise<FacePreviewInferenceResult> {
  const cfg = getServerFaceCaptureConfig();
  const modelsDir = resolve(process.cwd(), cfg.modelsDir);

  const payload = await execPythonPreview(jpeg, {
    python: cfg.previewPython,
    modelsDir,
  });

  return normalizePreviewPayload(payload, cfg.detector, cfg.expression);
}

function execPythonPreview(
  jpeg: Buffer,
  opts: { python: string; modelsDir: string }
): Promise<Record<string, unknown>> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(opts.python, [SCRIPT], {
      env: {
        ...process.env,
        FACE_CAPTURE_MODELS_DIR: opts.modelsDir,
        PROJECT_ROOT: process.cwd(),
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("face preview inference timed out"));
    }, TIMEOUT_MS);

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
      if (code !== 0) {
        reject(
          new Error(
            stderr.trim() || `face preview python exited with code ${code}`
          )
        );
        return;
      }
      const line = stdout.trim().split("\n").pop() || "{}";
      try {
        resolvePromise(JSON.parse(line) as Record<string, unknown>);
      } catch {
        reject(new Error(`invalid preview JSON: ${line.slice(0, 200)}`));
      }
    });

    child.stdin.write(jpeg);
    child.stdin.end();
  });
}

function normalizePreviewPayload(
  raw: Record<string, unknown>,
  detector: "mediapipe" | "retinaface",
  expression: "blendshapes" | "classifier"
): FacePreviewInferenceResult {
  if (raw.ok === false) {
    return {
      box: null,
      pose: null,
      expression: null,
      detector,
      expressionBackend: expression,
      detectorAvailable: false,
      expressionAvailable: false,
      warning:
        typeof raw.error === "string" ? raw.error : "preview inference failed",
    };
  }

  const box = parseBox(raw.box);
  const pose = parsePose(raw.pose);
  const expr = parseExpression(raw.expression);

  return {
    box,
    pose,
    expression: expr,
    detector: "retinaface",
    expressionBackend: "classifier",
    detectorAvailable: Boolean(raw.detectorAvailable),
    expressionAvailable: Boolean(raw.expressionAvailable),
    warning: typeof raw.warning === "string" ? raw.warning : undefined,
  };
}

function parseBox(v: unknown): FacePreviewInferenceResult["box"] {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const x = num(o.x);
  const y = num(o.y);
  const width = num(o.width);
  const height = num(o.height);
  if (x == null || y == null || width == null || height == null) return null;
  if (width < 0.02 || height < 0.02) return null;
  return { x, y, width, height };
}

function parsePose(v: unknown): FacePreviewInferenceResult["pose"] {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const yaw = num(o.yaw);
  const pitch = num(o.pitch);
  const roll = num(o.roll);
  if (yaw == null || pitch == null || roll == null) return null;
  return { yaw, pitch, roll };
}

function parseExpression(
  v: unknown
): FacePreviewInferenceResult["expression"] {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const blink = num(o.blink);
  const smile = num(o.smile);
  if (blink == null || smile == null) return null;
  return {
    blink: clamp01(blink),
    smile: clamp01(smile),
  };
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}
