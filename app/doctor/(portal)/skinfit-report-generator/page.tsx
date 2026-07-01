"use client";

import Link from "next/link";
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
  const [eventLabel, setEventLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patientEmail, setPatientEmail] = useState("");
  const [patientName, setPatientName] = useState("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handleGenerate() {
    if (!file || !patientEmail.trim()) return;
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("patientEmail", patientEmail.trim());
      if (patientName.trim()) form.append("patientName", patientName.trim());
      if (outputName.trim()) {
        form.append("outputName", outputName.trim());
      }
      if (eventLabel.trim()) {
        form.append("eventLabel", eventLabel.trim());
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
      const attachedPending = res.headers.get("X-Clinic-Report-Attached-Pending") === "1";
      const downloadName =
        res.headers.get("X-Output-Filename") ??
        `${outputName.trim() || defaultOutputBasename(file.name)}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadName.endsWith(".pdf") ? downloadName : `${downloadName}.pdf`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);

      setSuccessMsg(
        attachedPending
          ? "Report generated and attached to the patient you registered earlier. Open Clinic reports to Send."
          : "Report generated and saved to Clinic reports. Open that section to Send, share via Gmail, or show QR."
      );
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

        <div className="mt-5 rounded-xl border border-[#242a5f]/15 bg-[#F8F9FC] p-5">
          <h2 className="text-sm font-semibold text-[#242a5f]">Patient</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-[#242a5f]">Patient email *</span>
              <input
                type="email"
                required
                value={patientEmail}
                onChange={(e) => setPatientEmail(e.target.value)}
                placeholder="patient@email.com"
                className="mt-1 w-full rounded-lg border border-[#242a5f]/20 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-[#242a5f]">Patient name</span>
              <input
                type="text"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#242a5f]/20 bg-white px-3 py-2 text-sm"
              />
            </label>
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          className="mt-6 cursor-pointer rounded-xl border border-dashed border-[#242a5f]/25 bg-[#F8F9FC] p-6 text-center transition hover:border-[#242a5f]/50 hover:bg-white"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
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
            {file ? file.name : "Drop PDF here or choose a file"}
          </p>
          <button
            type="button"
            className="mt-3 rounded-lg border border-[#242a5f]/20 bg-white px-4 py-2 text-sm font-medium text-[#242a5f] hover:bg-[#F8F9FC]"
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
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
        </label>

        <label className="mt-4 block">
          <span className="text-sm font-medium text-[#242a5f]">Event / occasion label</span>
          <input
            type="text"
            value={eventLabel}
            onChange={(e) => setEventLabel(e.target.value)}
            placeholder="e.g. FLO Santé"
            className="mt-1.5 block w-full rounded-lg border border-[#242a5f]/20 bg-white px-3 py-2.5 text-sm text-zinc-800 outline-none focus:ring-2 focus:ring-[#242a5f]/20"
          />
        </label>

        {error ? (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        {successMsg ? (
          <div className="mt-4 rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
            <p>{successMsg}</p>
            <Link
              href="/doctor/clinic-reports"
              className="mt-2 inline-block font-semibold text-emerald-900 underline-offset-2 hover:underline"
            >
              Open Clinic reports →
            </Link>
          </div>
        ) : null}

        <button
          type="button"
          disabled={!file || !patientEmail.trim() || loading}
          onClick={() => void handleGenerate()}
          className="mt-6 w-full rounded-xl bg-[#242a5f] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Generating & saving…" : "Generate SkinFit PDF"}
        </button>
      </div>
    </div>
  );
}
