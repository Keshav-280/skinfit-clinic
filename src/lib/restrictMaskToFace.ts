import { spawn } from "node:child_process";
import { resolve } from "node:path";

const SCRIPT = resolve(
  process.cwd(),
  "apps/ml-worker/python/restrict_mask_to_face.py"
);

const TIMEOUT_MS = 20_000;

function dataUriToBuffer(uri: string): Buffer {
  const comma = uri.indexOf(",");
  if (comma < 0) throw new Error("invalid data URI");
  return Buffer.from(uri.slice(comma + 1), "base64");
}

function bufferToDataUri(buf: Buffer): string {
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

function execRestrictMask(
  payload: { mask_b64: string; source_b64: string; kind: "acne" | "wrinkle" },
  python: string
): Promise<{ ok: boolean; jpeg_b64?: string; error?: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(python, [SCRIPT], {
      env: { ...process.env, PROJECT_ROOT: process.cwd() },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("restrict_mask_to_face timed out"));
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
            stderr.trim() || `restrict_mask_to_face exited with code ${code}`
          )
        );
        return;
      }
      const line = stdout.trim().split("\n").pop() || "{}";
      try {
        resolvePromise(JSON.parse(line) as { ok: boolean; jpeg_b64?: string; error?: string });
      } catch {
        reject(new Error(`invalid restrict mask JSON: ${line.slice(0, 200)}`));
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

/** Clip acne/wrinkle heatmap overlays to face skin (MediaPipe Face Mesh). */
export async function restrictMaskDataUriToFace(
  maskDataUri: string | undefined,
  sourceJpeg: Buffer,
  kind: "acne" | "wrinkle"
): Promise<string | undefined> {
  if (!maskDataUri?.startsWith("data:image/")) return maskDataUri;
  if (process.env.FACE_MASK_RESTRICT === "0") return maskDataUri;

  const python =
    process.env.MASK_RESTRICT_PYTHON?.trim() ||
    process.env.CAPTURE_PREVIEW_PYTHON?.trim() ||
    "python3";

  const result = await execRestrictMask(
    {
      mask_b64: dataUriToBuffer(maskDataUri).toString("base64"),
      source_b64: sourceJpeg.toString("base64"),
      kind,
    },
    python
  );

  if (!result.ok || !result.jpeg_b64) {
    throw new Error(result.error || "restrict_mask_to_face failed");
  }
  return bufferToDataUri(Buffer.from(result.jpeg_b64, "base64"));
}

export async function restrictScanMasksToFace(opts: {
  acneMaskDataUri?: string;
  wrinkleMaskDataUri?: string;
  centreJpeg: Buffer;
  smilingJpeg: Buffer;
}): Promise<{
  acneMaskDataUri?: string;
  wrinkleMaskDataUri?: string;
}> {
  const [acneMaskDataUri, wrinkleMaskDataUri] = await Promise.all([
    opts.acneMaskDataUri
      ? restrictMaskDataUriToFace(opts.acneMaskDataUri, opts.centreJpeg, "acne").catch(
          () => opts.acneMaskDataUri
        )
      : Promise.resolve(undefined),
    opts.wrinkleMaskDataUri
      ? restrictMaskDataUriToFace(
          opts.wrinkleMaskDataUri,
          opts.smilingJpeg,
          "wrinkle"
        ).catch(() => opts.wrinkleMaskDataUri)
      : Promise.resolve(undefined),
  ]);
  return { acneMaskDataUri, wrinkleMaskDataUri };
}
