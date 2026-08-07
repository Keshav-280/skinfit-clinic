import { spawn } from "node:child_process";
import { resolve } from "node:path";
import {
  parseProxyRegion,
  type ProxyRegion,
} from "@/src/lib/scanDetectionRegions";
import { jpegDataUriOrB64ToRawB64 } from "@/src/lib/extractWrinkleLines";

const SCRIPT = resolve(
  process.cwd(),
  "apps/ml-worker/python/extract_proxy_regions.py"
);

const TIMEOUT_MS = 20_000;
/** Longer budget when PROXY_USE_DINO / local weights may load the backbone. */
const TIMEOUT_DINO_MS = 90_000;

function pythonBin(): string {
  return (
    process.env.PROXY_REGIONS_PYTHON?.trim() ||
    process.env.WRINKLE_LINES_PYTHON?.trim() ||
    process.env.CAPTURE_PREVIEW_PYTHON?.trim() ||
    "python3"
  );
}

export type ProxyRegionScores = {
  pigmentation?: number | null;
  acne_scars?: number | null;
  under_eye?: number | null;
  sagging_volume?: number | null;
};

function dinoEnabled(): boolean {
  const flag = process.env.PROXY_USE_DINO?.trim().toLowerCase();
  if (flag === "1" || flag === "true" || flag === "yes") return true;
  return Boolean(process.env.DINO_LOCAL_WEIGHTS?.trim());
}

/**
 * Landmark + DINOv2-attention proxy zones for params without spatial detectors.
 * Soft-fails to [] if MediaPipe/Python is unavailable.
 * Prefer passing `patchActivations` from the scoring backbone to avoid a second DINO load.
 */
export async function extractProxyRegionsFromImage(input: {
  sourceJpegB64: string;
  scores: ProxyRegionScores;
  /**
   * Optional 16×16 (or flat 256) patch activation map from the scoring
   * DINOv2 forward — preferred over loading the backbone again.
   */
  patchActivations?: number[] | number[][] | null;
  timeoutMs?: number;
}): Promise<ProxyRegion[]> {
  const sourceB64 = jpegDataUriOrB64ToRawB64(input.sourceJpegB64);
  if (!sourceB64) return [];

  // Skip spawn entirely when nothing would be emitted (all ≤1 / missing).
  const values = [
    input.scores.pigmentation,
    input.scores.acne_scars,
    input.scores.under_eye,
    input.scores.sagging_volume,
  ];
  const anyActive = values.some(
    (v) => typeof v === "number" && Number.isFinite(v) && v > 1
  );
  if (!anyActive) return [];

  const defaultTimeout =
    dinoEnabled() && !input.patchActivations ? TIMEOUT_DINO_MS : TIMEOUT_MS;

  try {
    const raw = await execExtract({
      source_b64: sourceB64,
      scores: {
        pigmentation: input.scores.pigmentation ?? 1,
        acne_scars: input.scores.acne_scars ?? 1,
        under_eye: input.scores.under_eye ?? 1,
        sagging_volume: input.scores.sagging_volume ?? 1,
      },
      patch_activations: input.patchActivations ?? undefined,
      timeoutMs: input.timeoutMs ?? defaultTimeout,
    });
    if (!raw || raw.ok === false) return [];
    const list = Array.isArray(raw.proxy_regions) ? raw.proxy_regions : [];
    const out: ProxyRegion[] = [];
    for (const item of list) {
      const parsed = parseProxyRegion(item);
      if (parsed) out.push(parsed);
    }
    return out;
  } catch {
    return [];
  }
}

function execExtract(payload: {
  source_b64: string;
  scores: Record<string, number>;
  patch_activations?: number[] | number[][];
  timeoutMs: number;
}): Promise<{ ok?: boolean; proxy_regions?: unknown; error?: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(pythonBin(), [SCRIPT], {
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("proxy region extraction timed out"));
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
            stderr.trim() || `extract_proxy_regions exited with code ${code}`
          )
        );
        return;
      }
      const line = stdout.trim().split("\n").pop() || "{}";
      try {
        resolvePromise(
          JSON.parse(line) as { ok?: boolean; proxy_regions?: unknown }
        );
      } catch {
        reject(new Error(`invalid proxy_regions JSON: ${line.slice(0, 200)}`));
      }
    });

    child.stdin.write(
      JSON.stringify({
        source_b64: payload.source_b64,
        scores: payload.scores,
        ...(payload.patch_activations
          ? { patch_activations: payload.patch_activations }
          : {}),
      })
    );
    child.stdin.end();
  });
}
