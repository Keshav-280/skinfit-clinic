/**
 * Call the spot-detector service (v18 zoned annotations).
 * Returns the annotated image as a data URI. Scores stay on the other models.
 */

interface SpotDetectorOpts {
  baseUrl: string;
  apiKey?: string;
  timeoutMs?: number;
}

export interface SpotCoordinate {
  x: number;
  y: number;
  x_pct: number;
  y_pct: number;
  type: "dark" | "red";
  severity: number;
}

export interface SpotDetectorResult {
  annotated_image: string;
  spots: SpotCoordinate[];
  summary: {
    total: number;
    dark: number;
    red: number;
  };
}

export async function runSpotDetector(
  imageFile: File,
  opts: SpotDetectorOpts
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
    const res = await fetch(`${opts.baseUrl}/analyze`, {
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
