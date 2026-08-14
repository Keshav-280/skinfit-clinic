"use client";

import { useRef, useState } from "react";

type AnalyzeResponse = {
  spot_count: number;
  detection_regions: Array<{
    class: string;
    confidence: number;
    center_pct: [number, number];
    delta_l?: number;
  }>;
  annotated_image_jpeg_base64?: string;
  meta?: {
    flagged_tiles?: number;
    grid_tiles?: [number, number];
    face_mesh_ok?: boolean;
  };
  error?: string;
};

export default function DarkSpotDetectorPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  function onPick(f: File | null) {
    setError(null);
    setSummary(null);
    setResultUrl(null);
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (f) setPreviewUrl(URL.createObjectURL(f));
    else setPreviewUrl(null);
  }

  async function analyze() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/tools/dark-spot-detector/analyze", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as AnalyzeResponse & { error?: string };
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      if (data.annotated_image_jpeg_base64) {
        setResultUrl(
          `data:image/jpeg;base64,${data.annotated_image_jpeg_base64}`
        );
      }
      setSummary(
        `${data.spot_count} dark region(s) · ${data.meta?.flagged_tiles ?? 0} flagged tiles · grid ${data.meta?.grid_tiles?.join("×") ?? "?"}`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F7F2] text-[#0F172A]">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">
          Standalone tool
        </p>
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">
          Dark spot grid detector
        </h1>
        <p className="mb-6 text-sm leading-relaxed text-[#64748B]">
          Upload a face photo. Each small skin tile is compared to its neighbors;
          sudden dark or brown shifts are circled in red. This tool is separate
          from the main kAI face scan — it does not change your existing models.
        </p>

        <div className="mb-6 rounded-2xl border border-[#DCE4DA] bg-white p-4">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mb-3 w-full rounded-xl border-2 border-dashed border-[#DCE4DA] px-4 py-8 text-sm text-[#64748B] transition hover:border-[#166534] hover:text-[#166534]"
          >
            {file ? file.name : "Tap to choose a face photo (JPG/PNG)"}
          </button>
          <button
            type="button"
            disabled={!file || loading}
            onClick={analyze}
            className="rounded-full bg-[#166534] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {loading ? "Analyzing…" : "Detect dark spots"}
          </button>
          {error ? (
            <p className="mt-3 text-sm text-red-700">{error}</p>
          ) : null}
          {summary ? (
            <p className="mt-3 text-sm text-[#64748B]">{summary}</p>
          ) : null}
        </div>

        {(previewUrl || resultUrl) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {previewUrl ? (
              <figure>
                <figcaption className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                  Original
                </figcaption>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Original"
                  className="w-full rounded-xl bg-[#111]"
                />
              </figure>
            ) : null}
            {resultUrl ? (
              <figure>
                <figcaption className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                  Annotated
                </figcaption>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resultUrl}
                  alt="Dark spots marked"
                  className="w-full rounded-xl bg-[#111]"
                />
              </figure>
            ) : null}
          </div>
        )}

        <p className="mt-8 text-xs text-[#94A3B8]">
          Direct API service (optional): run{" "}
          <code className="rounded bg-white px-1 py-0.5">
            uvicorn api.main:app --port 8001
          </code>{" "}
          from{" "}
          <code className="rounded bg-white px-1 py-0.5">
            services/pigmentation-detector-v1/api
          </code>
          , or set{" "}
          <code className="rounded bg-white px-1 py-0.5">
            PIGMENTATION_DETECTOR_SERVICE_URL
          </code>
          .
        </p>
      </div>
    </div>
  );
}
