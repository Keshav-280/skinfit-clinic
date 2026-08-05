"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { History, ImagePlus, Sun } from "lucide-react";
import { FaceScanFlow } from "@/components/dashboard/FaceScanFlow";
import { DiagnoseActivityRings } from "@/components/dashboard/DiagnoseActivityRings";
import { FACE_SCAN_INSTRUCTIONS_BELOW_CAMERA } from "@/src/lib/faceScanCaptures";

export default function ScanPage() {
  const [flowExpanded, setFlowExpanded] = useState(false);
  const [dropActive, setDropActive] = useState(false);

  const onLayoutExpanded = useCallback((expanded: boolean) => {
    setFlowExpanded(expanded);
  }, []);

  const feedFilesToScanFlow = useCallback((files: FileList | File[] | null) => {
    if (!files?.length) return;
    const input = document.getElementById(
      "scan-file-input"
    ) as HTMLInputElement | null;
    if (!input) return;
    const dt = new DataTransfer();
    Array.from(files).forEach((f) => dt.items.add(f));
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, []);

  return (
    <div
      className={
        flowExpanded
          ? "relative left-1/2 flex min-h-[calc(100dvh-5.5rem)] w-screen max-w-[100vw] -translate-x-1/2 flex-col overflow-hidden p-3 sm:p-4"
          : "mx-auto w-full max-w-5xl px-3 pb-10 pt-2 sm:px-4"
      }
    >
      <div
        className={
          flowExpanded
            ? "flex min-h-0 flex-1 flex-col"
            : "grid gap-4 md:grid-cols-2 md:items-stretch"
        }
      >
        {!flowExpanded ? <DiagnoseActivityRings /> : null}
        <FaceScanFlow
          variant="dashboard"
          onLayoutExpanded={onLayoutExpanded}
        />
      </div>

      {!flowExpanded ? (
        <div className="mt-6 space-y-4">
          <section className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#2C3E6B] shadow-sm ring-1 ring-zinc-100">
                <Sun className="h-4 w-4" aria-hidden />
              </span>
              <h2 className="text-base font-bold text-zinc-900">
                How to take the perfect scan
              </h2>
            </div>
            <ul className="space-y-2">
              {FACE_SCAN_INSTRUCTIONS_BELOW_CAMERA.map((line) => (
                <li
                  key={line}
                  className="flex gap-2 text-sm leading-relaxed text-zinc-600"
                >
                  <span
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2C3E6B]/50"
                    aria-hidden
                  />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDropActive(true);
            }}
            onDragLeave={() => setDropActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDropActive(false);
              feedFilesToScanFlow(e.dataTransfer.files);
            }}
            className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
              dropActive
                ? "border-[#2C3E6B]/40 bg-[#F2F9F2]"
                : "border-zinc-200 bg-white"
            }`}
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-50 text-[#2C3E6B]">
              <ImagePlus className="h-6 w-6" aria-hidden />
            </div>
            <p className="mt-3 text-sm font-semibold text-zinc-900">
              Drop a face photo here
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              Or choose photos from this device to fill your scan slots
            </p>
            <label
              htmlFor="scan-file-input"
              className="mt-4 inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-bold text-[#2C3E6B] shadow-sm transition hover:bg-zinc-50"
            >
              <ImagePlus className="h-4 w-4" aria-hidden />
              Choose photo
            </label>
          </div>

          <div className="flex justify-start">
            <Link
              href="/dashboard/history"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2C3E6B] transition hover:underline"
            >
              <History className="h-4 w-4" aria-hidden />
              Scan history
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
