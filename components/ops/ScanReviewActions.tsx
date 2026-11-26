"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Photo = { label: string; poseId: string; original: string; marked: string | null };

const REASONS = [
  "The photo is blurred. Hold the phone steady in good light.",
  "The light is too low or uneven. Face a window or a bright lamp.",
  "Your full face is not visible. Move hair away and keep your face in the frame.",
  "Please remove glasses and makeup before scanning.",
];

/** Photos with their markings, then approve or ask for a retake. */
export function ScanReviewActions({
  reviewId,
  patientName,
  photos,
}: {
  reviewId: string;
  patientName: string;
  photos: Photo[];
}) {
  const router = useRouter();
  const [hidden, setHidden] = useState<string[]>([]);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(body: object) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/clinic/scan-reviews/${reviewId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(data.message || "Something went wrong. Please try again.");
      router.push("/clinic/ops/reviews");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {photos.map((p) => {
          const off = hidden.includes(p.poseId);
          return (
            <figure key={p.original} className="rounded-xl border border-[#E4E6F0] bg-white p-3">
              <figcaption className="text-sm font-semibold text-[#1E1B31]">{p.label}</figcaption>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.original} alt={`${p.label} photo`} className="mt-2 w-full rounded-lg bg-[#FAF8F5]" />
              {p.marked ? (
                <>
                  <p className="mt-3 text-xs font-semibold text-[#6B7280]">With markings</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.marked} alt={`${p.label} with markings`} className={`mt-1 w-full rounded-lg bg-[#FAF8F5] ${off ? "opacity-30" : ""}`} />
                  <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-[#1E1B31]">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={!off}
                      onChange={() => setHidden((h) => (off ? h.filter((x) => x !== p.poseId) : [...h, p.poseId]))}
                    />
                    Show these markings to the patient
                  </label>
                </>
              ) : (
                <p className="mt-2 text-xs text-[#6B7280]">No markings on this view.</p>
              )}
            </figure>
          );
        })}
      </div>

      {error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}

      {asking ? (
        <div className="space-y-3 rounded-xl border border-[#E4E6F0] bg-white p-4">
          <p className="text-sm font-semibold text-[#1E1B31]">What should {patientName} do differently? They will read this.</p>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button key={r} type="button" onClick={() => setReason(r)} className="rounded-full border border-[#1E1B31]/20 px-3 py-1.5 text-left text-xs text-[#1E1B31]">
                {r}
              </button>
            ))}
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            rows={3}
            aria-label="Reason for the retake"
            className="w-full rounded-lg border border-[#1E1B31]/20 p-3 text-sm text-[#1E1B31]"
          />
          <div className="flex gap-2">
            <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => void send({ action: "retake", reason })} className="rounded-xl bg-[#1E1B31] px-5 py-3 text-sm font-bold text-white disabled:opacity-60">
              Send retake request
            </button>
            <button type="button" disabled={busy} onClick={() => setAsking(false)} className="px-4 py-3 text-sm font-semibold text-[#6B7280]">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (window.confirm(`Release this report to ${patientName}?`)) void send({ action: "approve", hiddenPoses: hidden });
            }}
            className="rounded-xl bg-[#1E1B31] px-6 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {busy ? "Releasing…" : "Approve and send"}
          </button>
          <button type="button" disabled={busy} onClick={() => setAsking(true)} className="rounded-xl border border-[#1E1B31]/20 bg-white px-6 py-3 text-sm font-semibold text-[#1E1B31]">
            Ask for retake
          </button>
        </div>
      )}
    </div>
  );
}
