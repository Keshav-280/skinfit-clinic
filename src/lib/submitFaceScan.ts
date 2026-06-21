/**
 * Submit a five-angle face scan — prefers async queue, falls back to legacy sync API.
 */

import type { FaceIdentityImageCheck } from "@/src/lib/scanFaceIdentityGate";

export type FaceScanSubmitResult =
  | { mode: "queued"; jobId: string }
  | { mode: "completed"; scanId: number }
  | {
      mode: "error";
      message: string;
      status: number;
      identityChecks?: FaceIdentityImageCheck[];
    };

type ScanErrorJson = {
  error?: string;
  message?: string;
  identityChecks?: FaceIdentityImageCheck[];
};

export async function submitFaceScan(
  formData: FormData,
  fetchImpl: typeof fetch = fetch
): Promise<FaceScanSubmitResult> {
  const submitRes = await fetchImpl("/api/scans/submit", {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  if (submitRes.status === 202) {
    const queued = (await submitRes.json()) as { jobId?: string; status?: string };
    if (queued.jobId) {
      return { mode: "queued", jobId: queued.jobId };
    }
  }

  // Async mode on server: do not fall back to legacy /api/scan (returns 410).
  if (submitRes.status !== 503) {
    const errJson = (await submitRes.json().catch(() => ({}))) as ScanErrorJson;
    return {
      mode: "error",
      message:
        errJson.message ||
        errJson.error ||
        `Could not queue scan (${submitRes.status}).`,
      status: submitRes.status,
      identityChecks: errJson.identityChecks,
    };
  }

  const res = await fetchImpl("/api/scan", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  const json = (await res.json()) as ScanErrorJson & {
    success?: boolean;
    data?: { id?: number };
  };

  if (!res.ok || !json.success) {
    return {
      mode: "error",
      message:
        json.message ||
        json.error ||
        (res.status === 401
          ? "Sign in to save your scan."
          : res.status === 410
            ? "Scan is processing in the background. Check History shortly."
            : "Scan failed. Try again."),
      status: res.status,
      identityChecks: json.identityChecks,
    };
  }

  const scanId = json.data?.id;
  if (typeof scanId === "number" && scanId >= 1) {
    return { mode: "completed", scanId };
  }

  return {
    mode: "error",
    message: "Scan saved but no report id returned.",
    status: res.status,
  };
}
