"use client";

import { useRef, useState } from "react";
import { defaultOutputBasename } from "@/src/lib/sdetectReport/outputFilename";

function pickFile(
  f: File,
  setFile: (file: File) => void,
  setOutputName: (name: string) => void
) {
  setFile(f);
  setOutputName(defaultOutputBasename(f.name));
}

export default function SkinfitReportGeneratorPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [outputName, setOutputName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      if (outputName.trim()) {
        form.append("outputName", outputName.trim());
      }
      const res = await fetch("/api/skinfit-report-generator", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (res.status === 401) {
        throw new Error("Please sign in to the doctor portal first.");
      }
      if (!res.ok) {
        const contentType = res.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          const j = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(j?.error ?? `Generation failed (${res.status})`);
        }
        const text = (await res.text().catch(() => "")).trim();
        throw new Error(text || `Generation failed (${res.status})`);
      }
      const blob = await res.blob();
      const downloadName =
        res.headers.get("X-Output-Filename") ??
        `${outputName.trim() || defaultOutputBasename(file.name)}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadName.endsWith(".pdf") ? downloadName : `${downloadName}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">
      <div className="rounded-2xl border border-white/40 bg-white/80 p-8 shadow-sm backdrop-blur-sm">
        <h1 className="text-2xl font-semibold text-[#242a5f]">SkinFit report generator</h1>

        <div
          className="mt-6 rounded-xl border border-dashed border-[#242a5f]/25 bg-[#F8F9FC] p-6 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) pickFile(f, setFile, setOutputName);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pickFile(f, setFile, setOutputName);
            }}
          />
          <p className="text-sm text-zinc-700">
            {file ? file.name : "Drop a PDF here or choose a file"}
          </p>
          <button
            type="button"
            className="mt-3 rounded-lg border border-[#242a5f]/20 px-4 py-2 text-sm font-medium text-[#242a5f] hover:bg-white"
            onClick={() => inputRef.current?.click()}
          >
            Choose PDF
          </button>
        </div>

        <label className="mt-5 block">
          <span className="text-sm font-medium text-[#242a5f]">Output filename</span>
          <div className="mt-1.5 flex overflow-hidden rounded-lg border border-[#242a5f]/20 bg-white focus-within:ring-2 focus-within:ring-[#242a5f]/20">
            <input
              type="text"
              value={outputName}
              onChange={(e) => setOutputName(e.target.value)}
              placeholder="skinfit-report"
              disabled={!file}
              className="min-w-0 flex-1 px-3 py-2.5 text-sm text-zinc-800 outline-none disabled:bg-zinc-50 disabled:text-zinc-400"
            />
            <span className="flex items-center border-l border-[#242a5f]/15 bg-[#F8F9FC] px-3 text-sm text-zinc-500">
              .pdf
            </span>
          </div>
          <span className="mt-1 block text-xs text-zinc-500">
            Auto-filled from upload; edit before generating.
          </span>
        </label>

        {error ? (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        <button
          type="button"
          disabled={!file || loading}
          onClick={() => void handleGenerate()}
          className="mt-6 w-full rounded-xl bg-[#242a5f] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Generating…" : "Generate SkinFit PDF"}
        </button>
      </div>
    </div>
  );
}
