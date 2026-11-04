"use client";

import { useState } from "react";
import { ScanDetectionOverlay } from "@/components/dashboard/ScanDetectionOverlay";
import type { ConcernChipId } from "@/components/dashboard/ConcernChips";
import type {
  DetectionRegion,
  ProxyRegion,
  WrinkleLine,
} from "@/src/lib/scanDetectionRegions";

type Photo = {
  label: string;
  imageUrl: string;
  patientUrl: string;
  hasBaked: boolean;
  poseId: string;
  hidden: boolean;
  regions: DetectionRegion[];
  isCentre: boolean;
};

const FILTERS: { id: ConcernChipId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "acne", label: "Acne" },
  { id: "pigmentation", label: "Pigmentation" },
  { id: "wrinkles", label: "Wrinkles" },
  { id: "acne_scars", label: "Scars" },
  { id: "under_eye", label: "Under-eye" },
  { id: "sagging_volume", label: "Sagging" },
];

export function OpsScanInspector({
  scanId,
  photos,
  wrinkleLines,
  proxyRegions,
  scores,
  stored,
}: {
  scanId: number;
  photos: Photo[];
  wrinkleLines: WrinkleLine[];
  proxyRegions: ProxyRegion[];
  scores: Record<string, unknown>;
  stored: Record<string, number>;
}) {
  const [concern, setConcern] = useState<ConcernChipId>("all");
  const [showOverlay, setShowOverlay] = useState(true);
  const [hiddenPoses, setHiddenPoses] = useState<Record<string, boolean>>(
    Object.fromEntries(photos.map((p) => [p.poseId, p.hidden]))
  );
  const [busy, setBusy] = useState<string | null>(null);
  async function toggleHidden(poseId: string) {
    const next = !hiddenPoses[poseId];
    setBusy(poseId);
    try {
      const res = await fetch(`/api/clinic/ops/scans/${scanId}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pose: poseId, hidden: next }),
      });
      if (res.ok) setHiddenPoses((h) => ({ ...h, [poseId]: next }));
      else alert("Could not update. Please try again.");
    } finally {
      setBusy(null);
    }
  }
  const [mode, setMode] = useState<"patient" | "raw">("patient");
  const model = (scores.modelFeatureScores ?? {}) as Record<string, unknown>;
  const nRegions = photos.reduce((n, p) => n + p.regions.length, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setConcern(f.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              concern === f.id
                ? "bg-[#1E1B31] text-white"
                : "border border-[#E4E6F0] bg-white text-[#1E1B31]"
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="flex rounded-full border border-[#E4E6F0] bg-white p-0.5 text-sm font-semibold">
          {(["patient", "raw"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-full px-3 py-1 ${mode === m ? "bg-[#2B2F63] text-white" : ""}`}
            >
              {m === "patient" ? "What patient sees" : "Raw detector data"}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showOverlay}
            onChange={(e) => setShowOverlay(e.target.checked)}
          />
          Show annotations
        </label>
      </div>
      <p className="text-xs text-[#6B7280]">
        {mode === "patient"
          ? "Exactly as the patient report shows it: the pre-rendered annotated photo for each pose, plus landmark zones on the front photo. No wrinkle lines are shown to patients."
          : "Raw stored detector output, which can differ from what patients see."}{" "}
        Circles are detector findings ({nRegions} across all photos). Dashed ellipses are landmark zones drawn
        from the score, so they are not proof of a detection. Wrinkle lines come from the wrinkle mask.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((p) => (
          <figure key={p.label} className="space-y-1">
            <div className="relative overflow-hidden rounded-xl border border-[#E4E6F0] bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mode === "patient" ? p.patientUrl : p.imageUrl} alt={p.label} className="block w-full" />
              {showOverlay ? (
                <ScanDetectionOverlay
                  regions={mode === "patient" && p.hasBaked ? [] : p.regions}
                  wrinkleLines={mode === "raw" && p.isCentre ? wrinkleLines : []}
                  proxyRegions={p.isCentre ? proxyRegions : []}
                  activeConcern={concern}
                />
              ) : null}
            </div>
            {p.hasBaked && p.poseId ? (
              <button
                type="button"
                disabled={busy === p.poseId}
                onClick={() => toggleHidden(p.poseId)}
                className={`w-full rounded-lg px-2 py-1.5 text-xs font-semibold ${
                  hiddenPoses[p.poseId]
                    ? "bg-[#1E1B31] text-white"
                    : "border border-[#DF9DA4] bg-[#F8EDEE] text-[#1E1B31]"
                }`}
              >
                {hiddenPoses[p.poseId]
                  ? "Hidden from patient. Tap to show again"
                  : "Annotations look wrong? Hide from patient"}
              </button>
            ) : null}
            <figcaption className="text-xs text-[#6B7280]">
              {p.label} · {mode === "patient" ? (p.hasBaked ? "annotated photo" : "plain photo") : `${p.regions.length} circles`}
              {p.isCentre
                ? ` · ${wrinkleLines.length} wrinkle lines · ${proxyRegions.length} zones`
                : ""}
            </figcaption>
          </figure>
        ))}
      </div>

      <section className="rounded-xl border border-[#E4E6F0] bg-white p-3">
        <h2 className="mb-2 text-sm font-semibold">
          Stored scores (0-100) and raw model severities (1-5)
        </h2>
        <table className="w-full text-sm">
          <tbody>
            {Object.entries(stored).map(([k, v]) => (
              <tr key={k} className="border-t border-[#E4E6F0]">
                <td className="p-1">{k}</td>
                <td className="p-1 font-mono">{v}</td>
              </tr>
            ))}
            {Object.entries(model).map(([k, v]) => (
              <tr key={k} className="border-t border-[#E4E6F0]">
                <td className="p-1">model: {k}</td>
                <td className="p-1 font-mono">{v == null ? "null" : String(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-[#6B7280]">
          Estimate review: {scores.scoreReview ? "present" : "none"} · Doctor overrides:{" "}
          {scores.doctorOverrides ? "present" : "none"} (details in raw JSON below)
        </p>
      </section>

      <details className="rounded-xl border border-[#E4E6F0] bg-white p-3">
        <summary className="cursor-pointer text-sm font-semibold">Raw scores JSON</summary>
        <pre className="mt-2 max-h-96 overflow-auto text-xs">
          {JSON.stringify(
            scores,
            (_k, v) =>
              typeof v === "string" && v.length > 200
                ? `${v.slice(0, 40)}...(${v.length} chars)`
                : v,
            2
          )}
        </pre>
      </details>
    </div>
  );
}
