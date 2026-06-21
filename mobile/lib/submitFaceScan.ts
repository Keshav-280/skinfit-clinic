import { apiFetch } from "@/lib/api";
import { formatFaceIdentityCheckSummary } from "../../src/lib/faceIdentityCheckDisplay";
import type { FaceIdentityImageCheck } from "../../src/lib/scanFaceIdentityGate";

export type FaceScanSubmitResult =
  | { mode: "queued"; jobId: string }
  | { mode: "completed"; scanId: number }
  | {
      mode: "error";
      message: string;
      identityChecks?: FaceIdentityImageCheck[];
    };

type ScanErrorJson = {
  error?: string;
  message?: string;
  identityChecks?: FaceIdentityImageCheck[];
};

export async function submitFaceScan(
  token: string,
  form: FormData
): Promise<FaceScanSubmitResult> {
  const submitRes = await apiFetch("/api/scans/submit", token, {
    method: "POST",
    body: form,
  });

  if (submitRes.status === 202) {
    const queued = (await submitRes.json()) as { jobId?: string };
    if (queued.jobId) {
      return { mode: "queued", jobId: queued.jobId };
    }
  }

  if (submitRes.status !== 503 && !submitRes.ok && submitRes.status !== 202) {
    const err = (await submitRes.json().catch(() => ({}))) as ScanErrorJson;
    return {
      mode: "error",
      message: err.message || err.error || "Could not queue scan.",
      identityChecks: err.identityChecks,
    };
  }

  const res = await apiFetch("/api/scan", token, { method: "POST", body: form });
  const data = (await res.json()) as ScanErrorJson & {
    success?: boolean;
    data?: { id?: number };
  };

  if (!res.ok || !data.success || !data.data?.id) {
    return {
      mode: "error",
      message: data.message || data.error || "Scan failed.",
      identityChecks: data.identityChecks,
    };
  }

  return { mode: "completed", scanId: data.data.id };
}

export function formatFaceScanIdentityError(
  message: string,
  identityChecks?: FaceIdentityImageCheck[]
): string {
  if (!identityChecks?.length) return message;
  return `${message}\n\n${formatFaceIdentityCheckSummary(identityChecks)}`;
}
