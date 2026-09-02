/**
 * v18 zoned spot annotations (dashed circles).
 * kAI / acne-detector scores stay on the previous scoring models.
 */

import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileToJpegB64 } from "@/src/lib/extractWrinkleLines";
import type { DetectionRegion } from "@/src/lib/scanDetectionRegions";

interface SpotDetectorOpts {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
}

export type SpotKind = "dark" | "acne" | "scar";

export interface SpotCoordinate {
  x: number;
  y: number;
  r?: number;
  x_pct: number;
  y_pct: number;
  r_pct?: number;
  type: "dark" | "red";
  kind?: SpotKind;
  severity: number;
}

export interface SpotDetectorResult {
  annotated_image: string;
  spots: SpotCoordinate[];
  summary: {
    total: number;
    dark: number;
    red: number;
    scar?: number;
  };
}

const SCRIPT = resolve(
  process.cwd(),
  "services/spot-detector-v15/api/spot_v18.py"
);

function pythonBin(): string {
  return (
    process.env.SPOT_V18_PYTHON?.trim() ||
    process.env.WRINKLE_LINES_PYTHON?.trim() ||
    process.env.CAPTURE_PREVIEW_PYTHON?.trim() ||
    (process.platform === "win32" ? "python" : "python3")
  );
}

function spotKind(spot: SpotCoordinate): SpotKind {
  if (spot.kind === "acne" || spot.kind === "scar" || spot.kind === "dark") {
    return spot.kind;
  }
  return spot.type === "red" ? "acne" : "dark";
}

function classForKind(kind: SpotKind): {
  class: string;
  display_class: string;
} {
  if (kind === "acne") return { class: "papule", display_class: "Acne" };
  if (kind === "scar")
    return { class: "acne_scars", display_class: "Acne scars" };
  return { class: "pigmentation", display_class: "Pigmentation" };
}

export function spotsToDetectionRegions(
  spots: SpotCoordinate[]
): DetectionRegion[] {
  const out: DetectionRegion[] = [];
  for (const spot of spots) {
    const kind = spotKind(spot);
    const labels = classForKind(kind);
    const cx = spot.x_pct;
    const cy = spot.y_pct;
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;
    const r = Number.isFinite(spot.r_pct)
      ? Math.max(0.6, spot.r_pct as number)
      : 2.2;
    const conf = Number.isFinite(spot.severity)
      ? Math.min(1, Math.max(0.15, spot.severity / 20))
      : 0.5;
    out.push({
      class: labels.class,
      display_class: labels.display_class,
      confidence: Math.round(conf * 100) / 100,
      center_pct: [Math.round(cx * 100) / 100, Math.round(cy * 100) / 100],
      radius_pct: Math.round(r * 100) / 100,
      bbox_pct: [
        Math.round((cx - r) * 100) / 100,
        Math.round((cy - r) * 100) / 100,
        Math.round((cx + r) * 100) / 100,
        Math.round((cy + r) * 100) / 100,
      ],
    });
  }
  return out;
}

export function spotsToDetectedRegions(spots: SpotCoordinate[]): Array<{
  issue: string;
  coordinates: { x: number; y: number };
}> {
  return spots.map((s) => ({
    issue: classForKind(spotKind(s)).display_class,
    coordinates: {
      x: Math.round(s.x_pct * 10) / 10,
      y: Math.round(s.y_pct * 10) / 10,
    },
  }));
}

async function runSpotDetectorHttp(
  imageFile: File,
  opts: Required<Pick<SpotDetectorOpts, "baseUrl">> & SpotDetectorOpts
): Promise<SpotDetectorResult> {
  const form = new FormData();
  form.append("file", imageFile);

  const headers: Record<string, string> = {};
  if (opts.apiKey) headers["X-API-Key"] = opts.apiKey;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    opts.timeoutMs ?? 60_000
  );

  try {
    const res = await fetch(`${opts.baseUrl.replace(/\/$/, "")}/analyze`, {
      method: "POST",
      body: form,
      headers,
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `spot-detector responded ${res.status}: ${text.slice(0, 200)}`
      );
    }

    return (await res.json()) as SpotDetectorResult;
  } finally {
    clearTimeout(timeout);
  }
}

type LocalResult = {
  ok?: boolean;
  annotated_b64?: string;
  spots?: SpotCoordinate[];
  summary?: SpotDetectorResult["summary"];
  error?: string;
};

function runSpotDetectorLocal(
  imageB64: string,
  timeoutMs: number
): Promise<SpotDetectorResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(pythonBin(), [SCRIPT, "--stdin"], {
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(
        new Error(
          `spot v18 timed out${stderr.trim() ? `: ${stderr.trim().slice(0, 300)}` : ""}`
        )
      );
    }, timeoutMs);

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
      const line = stdout.trim().split("\n").pop() || "";
      if (!line) {
        reject(
          new Error(
            stderr.trim() || `spot_v18.py exited with code ${code}`
          )
        );
        return;
      }
      try {
        const parsed = JSON.parse(line) as LocalResult;
        if (!parsed.ok || !parsed.annotated_b64) {
          reject(new Error(parsed.error || "spot v18 returned no image"));
          return;
        }
        resolvePromise({
          annotated_image: `data:image/jpeg;base64,${parsed.annotated_b64}`,
          spots: Array.isArray(parsed.spots) ? parsed.spots : [],
          summary: parsed.summary ?? {
            total: parsed.spots?.length ?? 0,
            dark: 0,
            red: 0,
          },
        });
      } catch {
        reject(
          new Error(
            `invalid spot v18 JSON: ${line.slice(0, 200)}${
              stderr.trim() ? ` | ${stderr.trim().slice(0, 200)}` : ""
            }`
          )
        );
      }
    });

    child.stdin.write(JSON.stringify({ image_b64: imageB64 }));
    child.stdin.end();
  });
}

/** HTTP service if configured, otherwise the local v18 Python. */
export async function runSpotDetector(
  imageFile: File,
  opts: SpotDetectorOpts = {}
): Promise<SpotDetectorResult> {
  const baseUrl =
    opts.baseUrl?.trim() ||
    process.env.SPOT_DETECTOR_SERVICE_URL?.trim() ||
    "";
  const disabled =
    process.env.SPOT_DETECTOR_DISABLED === "1" ||
    process.env.SPOT_DETECTOR_DISABLED === "true";
  if (disabled) {
    throw new Error("spot detector disabled");
  }

  if (baseUrl) {
    return runSpotDetectorHttp(imageFile, {
      ...opts,
      baseUrl,
    });
  }

  const b64 = await fileToJpegB64(imageFile);
  return runSpotDetectorLocal(b64, opts.timeoutMs ?? 90_000);
}

export type SpotAnnotationPose = "centre" | "left" | "right";

export async function annotateScanPoses(input: {
  files: Partial<Record<SpotAnnotationPose, File>>;
  apiKey?: string;
  timeoutMs?: number;
}): Promise<{
  annotatedByPose: Record<string, string>;
  regionsByPose: Record<string, DetectionRegion[]>;
  centreRegions: DetectionRegion[];
  detectedRegions: Array<{ issue: string; coordinates: { x: number; y: number } }>;
}> {
  const annotatedByPose: Record<string, string> = {};
  const regionsByPose: Record<string, DetectionRegion[]> = {};
  let centreSpots: SpotCoordinate[] = [];

  for (const pose of ["centre", "left", "right"] as const) {
    const file = input.files[pose];
    if (!file) continue;
    try {
      const result = await runSpotDetector(file, {
        apiKey: input.apiKey,
        timeoutMs: input.timeoutMs,
      });
      if (result.annotated_image) {
        annotatedByPose[pose] = result.annotated_image;
      }
      const regions = spotsToDetectionRegions(result.spots ?? []);
      if (regions.length > 0) regionsByPose[pose] = regions;
      if (pose === "centre") centreSpots = result.spots ?? [];
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("[spot-v18] skipped", { pose, error: message });
    }
  }

  return {
    annotatedByPose,
    regionsByPose,
    centreRegions: regionsByPose.centre ?? [],
    detectedRegions: spotsToDetectedRegions(centreSpots),
  };
}
