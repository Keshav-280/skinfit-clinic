import { spawn } from "node:child_process";
import { resolve } from "node:path";

import { getServerFaceCaptureConfig } from "@/src/lib/faceCaptureConfig";

const SCRIPT = resolve(
  process.cwd(),
  "apps/ml-worker/python/face_identity_infer.py"
);

const TIMEOUT_MS = 20_000;

export type FaceEmbeddingResult =
  | { ok: true; embedding: number[]; dim: number }
  | { ok: false; faceDetected: boolean; error: string };

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (denom < 1e-9) return 0;
  return dot / denom;
}

export function isFaceIdentityVerificationEnabled(): boolean {
  const raw = process.env.FACE_IDENTITY_VERIFICATION?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off") return false;
  return true;
}

export function faceIdentityMatchThreshold(): number {
  const parsed = Number.parseFloat(
    process.env.FACE_IDENTITY_MATCH_THRESHOLD?.trim() || "0.42"
  );
  if (!Number.isFinite(parsed)) return 0.42;
  return clampFaceIdentityThreshold(parsed);
}

function clampFaceIdentityThreshold(value: number): number {
  return Math.max(0.2, Math.min(0.95, value));
}

/** Lower bar for side profiles (harder to match a front reference). */
export function faceIdentityProfileMatchThreshold(): number {
  const raw = process.env.FACE_IDENTITY_PROFILE_MATCH_THRESHOLD?.trim();
  if (raw) {
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed)) return clampFaceIdentityThreshold(parsed);
  }
  return clampFaceIdentityThreshold(
    Math.max(0.28, faceIdentityMatchThreshold() - 0.1)
  );
}

const FACE_IDENTITY_PROFILE_LABELS = new Set(["left", "right"]);

/** Match threshold for a capture step id (front uses the stricter default). */
export function faceIdentityMatchThresholdForLabel(label: string): number {
  if (label === "centre" || label === "center") {
    return faceIdentityMatchThreshold();
  }
  if (FACE_IDENTITY_PROFILE_LABELS.has(label)) {
    return faceIdentityProfileMatchThreshold();
  }
  return faceIdentityMatchThreshold();
}

export async function extractFaceEmbedding(
  jpeg: Buffer
): Promise<FaceEmbeddingResult> {
  const cfg = getServerFaceCaptureConfig();
  const payload = await execPythonEmbed(jpeg, cfg.previewPython);
  if (payload.ok !== true || !Array.isArray(payload.embedding)) {
    return {
      ok: false,
      faceDetected: Boolean(payload.faceDetected),
      error:
        typeof payload.error === "string"
          ? payload.error
          : "face_identity_embed_failed",
    };
  }
  const embedding = payload.embedding.filter((x) => typeof x === "number");
  if (embedding.length < 8) {
    return {
      ok: false,
      faceDetected: false,
      error: "embedding_too_short",
    };
  }
  return {
    ok: true,
    embedding,
    dim: typeof payload.dim === "number" ? payload.dim : embedding.length,
  };
}

function execPythonEmbed(
  jpeg: Buffer,
  python: string
): Promise<Record<string, unknown>> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(python, [SCRIPT], {
      env: { ...process.env, PROJECT_ROOT: process.cwd() },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("face identity inference timed out"));
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
      if (code !== 0 && !stdout.trim()) {
        reject(
          new Error(
            stderr.trim() || `face identity python exited with code ${code}`
          )
        );
        return;
      }
      const line = stdout.trim().split("\n").pop() || "{}";
      try {
        resolvePromise(JSON.parse(line) as Record<string, unknown>);
      } catch {
        reject(new Error(`invalid face identity JSON: ${line.slice(0, 200)}`));
      }
    });

    child.stdin.write(jpeg);
    child.stdin.end();
  });
}
