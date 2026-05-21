"use client";

import { useState } from "react";

type ApiResult = {
  ok: boolean;
  modelFeatureScores: Record<string, number>;
  scoresText: string;
  figureDataUri: string;
  inputDataUri: string;
  wrinkleMaskDataUri: string;
  acneMaskDataUri: string;
  wrinkleMaskShape: number[];
  acneObjectnessShape: number[];
};

export default function ScanTestingPage() {
  const [centreFile, setCentreFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!centreFile) {
      setError("Please provide an image.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const fd = new FormData();
      fd.append("centre", centreFile);

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
          "Inference API returned an old response (missing figureDataUri/scoresText). " +
            "Push latest face_analysis_tool to HF Space and wait for rebuild, then retry."
        );
      }

      setResult(data as ApiResult);
    } catch (err: any) {
      setError(err.message);
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
            Pipeline: <code>Resize((224,224))</code> &rarr; <code>ToTensor</code> &rarr; ImageNet normalize.
            No center-crop. Visualization is rendered server-side with matplotlib (same
            <code> subplots(1, 3, figsize=(12, 4)) </code>, same <code>cmap='Reds'</code>, same <code>alpha=0.5</code>, no thresholds).
          </p>
        </header>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
          <label className="mb-2 block font-semibold">Test image</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setCentreFile(e.target.files?.[0] || null)}
            className="w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
          />
          <button
            onClick={handleAnalyze}
            disabled={loading || !centreFile}
            className="mt-4 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition disabled:opacity-50"
          >
            {loading ? "Analyzing..." : "Run analysis"}
          </button>
        </div>

        {error && <div className="rounded-md bg-red-50 p-4 text-red-700">{error}</div>}

        {result && (
          <div className="space-y-8">
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Cell 6 — matplotlib figure</h2>
              <div className="rounded-md border border-gray-200 bg-white p-2">
                <img
                  src={result.figureDataUri}
                  alt="3-panel matplotlib figure (input, wrinkle mask, acne objectness)"
                  className="w-full"
                />
              </div>
            </section>

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
