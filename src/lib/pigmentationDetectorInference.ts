import { spawn } from "node:child_process";
import { resolve } from "node:path";

const SCRIPT = resolve(
  process.cwd(),
  "services/pigmentation-detector-v1/api/dark_spot_analyzer.py"
);

const TIMEOUT_MS = 45_000;

export type DarkSpotDetectionRegion = {
  class: string;
  display_class: string;
  confidence: number;
  center_pct: [number, number];
  radius_pct: number;
  bbox_pct: [number, number, number, number];
  delta_l?: number;
  tile_count?: number;
};

export type DarkSpotAnalyzeResult = {
  spot_count: number;
  detection_regions: DarkSpotDetectionRegion[];
  annotated_image_jpeg_base64?: string;
  meta?: Record<string, unknown>;
};

function pythonBin(): string {
  return (
    process.env.PIGMENTATION_DETECTOR_PYTHON?.trim() ||
    process.env.PROXY_REGIONS_PYTHON?.trim() ||
    process.env.WRINKLE_LINES_PYTHON?.trim() ||
    "python3"
  );
}

function runPythonAnalyzer(sourceB64: string): Promise<DarkSpotAnalyzeResult> {
  return new Promise((resolvePromise, reject) => {
    const py = spawn(
      pythonBin(),
      [SCRIPT],
      { stdio: ["pipe", "pipe", "pipe"] }
    );
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      py.kill("SIGKILL");
      reject(new Error("Dark spot analysis timed out"));
    }, TIMEOUT_MS);

    py.stdout.on("data", (c) => {
      stdout += String(c);
    });
    py.stderr.on("data", (c) => {
      stderr += String(c);
    });
    py.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    py.on("close", (code) => {
      clearTimeout(timer);
      const line = stdout.trim().split("\n").pop() ?? "";
      try {
        const parsed = JSON.parse(line) as {
          ok?: boolean;
          error?: string;
        } & DarkSpotAnalyzeResult;
        if (!parsed.ok) {
          reject(new Error(parsed.error || stderr || `exit ${code}`));
          return;
        }
        resolvePromise(parsed);
      } catch {
        reject(
          new Error(
            stderr.trim() ||
              `invalid JSON from dark_spot_analyzer (code ${code})`
          )
        );
      }
    });

    py.stdin.write(JSON.stringify({ source_b64: sourceB64 }));
    py.stdin.end();
  });
}

export async function runDarkSpotDetector(
  imageBytes: Buffer
): Promise<DarkSpotAnalyzeResult> {
  const serviceUrl = process.env.PIGMENTATION_DETECTOR_SERVICE_URL?.trim();
  if (serviceUrl) {
    const base = serviceUrl.replace(/\/$/, "");
    const form = new FormData();
    form.append(
      "file",
      new Blob([new Uint8Array(imageBytes)], { type: "image/jpeg" }),
      "face.jpg"
    );
    const headers: Record<string, string> = {};
    const key = process.env.PIGMENTATION_DETECTOR_API_KEY?.trim();
    if (key) headers["X-API-Key"] = key;
    const res = await fetch(`${base}/analyze`, {
      method: "POST",
      body: form,
      headers,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || `pigmentation-detector HTTP ${res.status}`);
    }
    return (await res.json()) as DarkSpotAnalyzeResult;
  }
  const b64 = imageBytes.toString("base64");
  return runPythonAnalyzer(b64);
}
