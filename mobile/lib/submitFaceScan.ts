import { apiFetch } from "@/lib/api";

export type FaceScanSubmitResult =
  | { mode: "queued"; jobId: string }
  | { mode: "completed"; scanId: number }
  | { mode: "error"; message: string };

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
    const err = (await submitRes.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    return {
      mode: "error",
      message: err.message || err.error || "Could not queue scan.",
    };
  }

  const res = await apiFetch("/api/scan", token, { method: "POST", body: form });
  const data = (await res.json()) as {
    success?: boolean;
    data?: { id?: number };
    error?: string;
  };

  if (!res.ok || !data.success || !data.data?.id) {
    return {
      mode: "error",
      message: data.error || "Scan failed.",
    };
  }

  return { mode: "completed", scanId: data.data.id };
}
