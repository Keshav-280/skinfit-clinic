"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Camera,
  Sparkles,
  RotateCcw,
  Check,
  ImagePlus,
  SwitchCamera,
} from "lucide-react";
import { SkinScanReportModal } from "../../../components/dashboard/SkinScanReportModal";

type ScanStep = "upload" | "confirm" | "naming" | "scanning" | "results";

interface ScanMetrics {
  acne: number;
  pigmentation: number;
  wrinkles: number;
  hydration: number;
  texture: number;
  overall_score: number;
}

interface DetectedRegion {
  issue: string;
  coordinates: { x: number; y: number };
}

interface ScanResults {
  metrics: ScanMetrics;
  detected_regions: DetectedRegion[];
  ai_summary?: string;
  userName?: string;
  scanDate?: string;
}

export default function ScanPage() {
  const router = useRouter();
  const [step, setStep] = useState<ScanStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanName, setScanName] = useState("");
  const [scanResults, setScanResults] = useState<ScanResults | null>(null);
  const [reportOpen, setReportOpen] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (scanResults) setReportOpen(true);
  }, [scanResults]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
    setCameraError(null);
  }, []);

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (!selectedFile.type.startsWith("image/")) return;
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setScanResults(null);
    setStep("confirm");
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !streamRef.current) return;
    const el = videoRef.current;
    el.srcObject = streamRef.current;
    void el.play().catch(() => {});
  }, [cameraOpen, facingMode]);

  const startCamera = useCallback(
    async (facing: "user" | "environment") => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          "Camera is not available in this browser. Try Chrome, Safari, or Edge, or upload a photo instead."
        );
        return;
      }
      setCameraError(null);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        streamRef.current = stream;
        setFacingMode(facing);
        setCameraOpen(true);
      } catch {
        setCameraError(
          "Could not open the camera. Allow permission in your browser, use HTTPS (or localhost), or upload a file instead."
        );
      }
    },
    []
  );

  const flipCamera = useCallback(() => {
    void startCamera(facingMode === "user" ? "environment" : "user");
  }, [facingMode, startCamera]);

  const captureFromCamera = useCallback(() => {
    const video = videoRef.current;
    if (!video || !streamRef.current) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const captured = new File(
          [blob],
          `skin-scan-${Date.now()}.jpg`,
          { type: "image/jpeg" }
        );
        stopCamera();
        handleFileSelect(captured);
      },
      "image/jpeg",
      0.92
    );
  }, [handleFileSelect, stopCamera]);

  const resetScan = useCallback(() => {
    stopCamera();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setStep("upload");
    setFile(null);
    setPreviewUrl(null);
    setScanName("");
    setScanResults(null);
  }, [previewUrl, stopCamera]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFileSelect(droppedFile);
    },
    [handleFileSelect]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) handleFileSelect(selectedFile);
    e.target.value = "";
  };

  const runScan = useCallback(async () => {
    if (!file || !scanName.trim()) return;
    setStep("scanning");
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("scanName", scanName.trim());
      const res = await fetch("/api/scan", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (json.success && json.data) {
        setScanResults(json.data);
        setStep("results");
        router.refresh();
      } else {
        setStep("naming");
      }
    } catch {
      setStep("naming");
    }
  }, [file, scanName, router]);

  return (
    <div className="space-y-6">
      <motion.header
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-center text-2xl font-bold tracking-tight text-zinc-900">
          AI Skin Scan
        </h1>
        <p className="mt-1 text-center text-sm text-zinc-600">
          Use your camera or upload a photo for AI skin analysis
        </p>
      </motion.header>

      {/* Step: Upload */}
      {step === "upload" && cameraOpen && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 rounded-[22px] border border-zinc-200 bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.06)] md:p-6"
        >
          <div className="relative overflow-hidden rounded-2xl bg-zinc-900 aspect-[3/4] max-h-[min(70vh,520px)] w-full mx-auto max-w-md">
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              playsInline
              muted
              autoPlay
              aria-label="Live camera preview"
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            <button
              type="button"
              onClick={captureFromCamera}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-teal-500 sm:w-auto sm:min-w-[200px] sm:flex-1"
            >
              <Camera className="h-5 w-5" />
              Capture photo
            </button>
            <button
              type="button"
              onClick={flipCamera}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white py-3.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 sm:w-auto sm:min-w-[140px]"
              aria-label="Switch between front and back camera"
            >
              <SwitchCamera className="h-5 w-5 text-[#6B8E8E]" />
              Flip camera
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="flex w-full items-center justify-center rounded-xl border border-zinc-200 bg-white py-3.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 sm:w-auto sm:min-w-[120px]"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      {step === "upload" && !cameraOpen && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="space-y-4"
        >
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`rounded-[22px] border-2 border-dashed p-10 text-center shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-colors md:p-12 ${
              isDragging
                ? "border-teal-500 bg-[#E0F0ED]/80"
                : "border-zinc-200 bg-white"
            }`}
          >
            <input
              id="scan-file-input"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleInputChange}
            />
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E0F0ED]">
              <ImagePlus className="h-8 w-8 text-[#6B8E8E]" />
            </div>
            <p className="mb-1 font-semibold text-zinc-900">Drop a photo here</p>
            <p className="mb-6 text-sm text-zinc-600">
              or choose from your gallery / files
            </p>
            <label
              htmlFor="scan-file-input"
              className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-zinc-200 bg-white px-6 py-3 text-sm font-semibold text-zinc-800 shadow-sm transition-colors hover:bg-zinc-50"
            >
              Choose file
            </label>
          </div>

          <div className="flex items-center gap-3 px-1">
            <div className="h-px flex-1 bg-zinc-200" />
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              or
            </span>
            <div className="h-px flex-1 bg-zinc-200" />
          </div>

          <button
            type="button"
            onClick={() => void startCamera("user")}
            className="flex w-full items-center justify-center gap-2 rounded-[22px] border-2 border-[#6B8E8E]/35 bg-[#E0F0ED]/60 py-4 text-sm font-semibold text-zinc-900 transition-colors hover:bg-[#E0F0ED]"
          >
            <Camera className="h-5 w-5 text-[#6B8E8E]" />
            Use device camera
          </button>

          {cameraError ? (
            <p
              className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900"
              role="alert"
            >
              {cameraError}
            </p>
          ) : null}
        </motion.div>
      )}

      {/* Step: Confirm */}
      {step === "confirm" && file && previewUrl && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <div className="overflow-hidden rounded-[22px] border border-zinc-100 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
            <div className="relative aspect-[3/4] max-h-[350px] w-full">
              <img
                src={previewUrl}
                alt="Preview"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => {
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                setFile(null);
                setPreviewUrl(null);
                setStep("upload");
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              <RotateCcw className="h-4 w-4" />
              Retake Image
            </button>
            <button
              type="button"
              onClick={() => setStep("naming")}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 text-sm font-medium text-white transition-colors hover:bg-teal-500"
            >
              <Check className="h-4 w-4" />
              Looks Good
            </button>
          </div>
        </motion.div>
      )}

      {/* Step: Naming */}
      {step === "naming" && previewUrl && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <div className="overflow-hidden rounded-[22px] border border-zinc-100 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
            <div className="relative aspect-[3/4] max-h-[280px] w-full">
              <img
                src={previewUrl}
                alt="Preview"
                className="h-full w-full object-cover grayscale-[20%]"
              />
            </div>
          </div>
          <div className="rounded-[22px] border border-zinc-100 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
            <label htmlFor="scan-name" className="mb-3 block text-sm font-medium text-zinc-700">
              Name this scan
            </label>
            <input
              id="scan-name"
              type="text"
              placeholder="e.g., Morning Routine"
              value={scanName}
              onChange={(e) => setScanName(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 placeholder:text-zinc-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
          <button
            type="button"
            onClick={runScan}
            disabled={!scanName.trim()}
            className="w-full rounded-xl bg-teal-600 py-3 text-sm font-medium text-white transition-colors hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Start Analysis
          </button>
        </motion.div>
      )}

      {/* Step: Scanning */}
      {step === "scanning" && previewUrl && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <div className="relative overflow-hidden rounded-[22px] border border-zinc-100 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
            <div className="relative aspect-[3/4] max-h-[400px] w-full">
              <img
                src={previewUrl}
                alt="Scanning"
                className="h-full w-full object-cover grayscale-[30%]"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/85 backdrop-blur-sm">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border-2 border-teal-500/40 border-t-teal-600"
                >
                  <Sparkles className="h-6 w-6 text-teal-600" />
                </motion.div>
                <p className="text-lg font-semibold text-zinc-900">Scanning...</p>
                <p className="mt-1 text-sm text-zinc-600">
                  AI is analyzing your skin
                </p>
                <motion.div
                  className="absolute left-0 right-0 z-10 h-1 bg-teal-500 shadow-[0_0_16px_rgba(20,184,166,0.5)]"
                  initial={{ top: "0%" }}
                  animate={{ top: ["0%", "100%", "0%"] }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Step: Results — full report modal */}
      {step === "results" && scanResults && previewUrl && (
        <>
          <SkinScanReportModal
            open={reportOpen}
            onClose={() => setReportOpen(false)}
            userName={scanResults.userName?.trim() || "there"}
            imageUrl={previewUrl}
            regions={scanResults.detected_regions}
            metrics={{
              acne: scanResults.metrics.acne,
              hydration: scanResults.metrics.hydration,
              wrinkles: scanResults.metrics.wrinkles,
              overall_score: scanResults.metrics.overall_score,
            }}
            aiSummary={scanResults.ai_summary}
            scanDate={
              scanResults.scanDate
                ? new Date(scanResults.scanDate)
                : new Date()
            }
          />
          {!reportOpen && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[22px] border border-zinc-200 bg-white p-8 text-center shadow-sm"
            >
              <p className="text-sm font-medium text-zinc-700">
                Report saved to your history. Start another scan whenever you
                like.
              </p>
              <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  onClick={() => setReportOpen(true)}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-6 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 sm:w-auto"
                >
                  View report again
                </button>
                <button
                  type="button"
                  onClick={resetScan}
                  className="w-full rounded-xl px-6 py-3 text-sm font-semibold text-white transition hover:opacity-95 sm:w-auto"
                  style={{ backgroundColor: "#6D8C8E" }}
                >
                  Scan another photo
                </button>
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
