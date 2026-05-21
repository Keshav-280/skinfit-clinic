"use client";

import { useState } from "react";

type ApiResult = {
  ok: boolean;
  dualPose: boolean;
  modelFeatureScores: Record<string, number>;
  scoresText: string;
  figureDataUri: string;
  smilingFigureDataUri?: string;
  mergedFigureDataUri?: string;
  wrinkleMaskShape: number[];
  acneObjectnessShape: number[];
};

export default function ScanTestingPage() {
  const [centreFile, setCentreFile] = useState<File | null>(null);
  const [smilingFile, setSmilingFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!centreFile) {
      setError("Please provide a centre (neutral) image.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const fd = new FormData();
      fd.append("centre", centreFile);
      if (smilingFile) {
        fd.append("smiling", smilingFile);
      }

      const res = await fetch("/api/scan_testing", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Analysis failed");
      }

      if (!data.figureDataUri || !data.scoresText) {
        throw new Error(
          "Inference API returned an old response. Push latest face_analysis_tool to HF and wait for rebuild."
        );
      }

      setResult(data as ApiResult);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white p-8 text-gray-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold">test_local.ipynb — Exact Replica</h1>
          <p className="text-sm text-gray-600">
            Centre: full test_local pipeline (3-panel figure, acne + scalars). Optional smiling:
            wrinkle score and mask from smile (like <code>analyze_v2</code>), plus a merged
            side-by-side overlay (centre+acne | smiling+wrinkle).
          </p>
        </header>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 space-y-4">
          <div>
            <label className="mb-2 block font-semibold">Centre (neutral)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setCentreFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          <div>
            <label className="mb-2 block font-semibold">Smiling (optional — wrinkle score + mask)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setSmilingFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading || !centreFile}
            className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition disabled:opacity-50"
          >
            {loading ? "Analyzing..." : "Run analysis"}
          </button>
        </div>

        {error && <div className="rounded-md bg-red-50 p-4 text-red-700">{error}</div>}

        {result && (
          <div className="space-y-8">
            {result.mergedFigureDataUri && (
              <section className="space-y-3">
                <h2 className="text-xl font-semibold">Merged overlay (dual pose)</h2>
                <div className="rounded-md border border-gray-200 bg-white p-2">
                  <img
                    src={result.mergedFigureDataUri}
                    alt="Merged centre acne and smiling wrinkle overlays"
                    className="w-full"
                  />
                </div>
              </section>
            )}

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                {result.dualPose ? "Centre — matplotlib figure" : "Cell 6 — matplotlib figure"}
              </h2>
              <div className="rounded-md border border-gray-200 bg-white p-2">
                <img
                  src={result.figureDataUri}
                  alt="3-panel matplotlib figure"
                  className="w-full"
                />
              </div>
            </section>

            {result.smilingFigureDataUri && (
              <section className="space-y-3">
                <h2 className="text-xl font-semibold">Smiling — matplotlib figure</h2>
                <div className="rounded-md border border-gray-200 bg-white p-2">
                  <img
                    src={result.smilingFigureDataUri}
                    alt="Smiling 3-panel figure"
                    className="w-full"
                  />
                </div>
              </section>
            )}

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Cell 5 — printed scores</h2>
              <pre className="overflow-auto rounded-md bg-gray-900 p-4 font-mono text-sm text-green-300">
{result.scoresText}
              </pre>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
