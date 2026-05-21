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
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { FaceCaptureOvalOverlayWeb } from "@/components/dashboard/FaceCaptureOvalOverlayWeb";
import { SkinScanReportModal } from "@/components/dashboard/SkinScanReportModal";
import {
  FACE_SCAN_CAPTURE_STEPS,
  FACE_SCAN_INSTRUCTIONS_BELOW_CAMERA,
} from "@/src/lib/faceScanCaptures";
import { BASELINE_ONBOARDING_SCAN_NAME } from "@/src/lib/onboardingConstants";

type ScanStep = "upload" | "confirm" | "naming" | "scanning" | "results";

interface ClinicalScores {
  active_acne?: number;
  skin_quality?: number;
  wrinkle_severity?: number;
  sagging_volume?: number;
  under_eye?: number;
  hair_health?: number;
  pigmentation_model?: number | null;
}

interface ScanMetrics {
  acne: number;
  pigmentation: number;
  wrinkles: number;
  hydration: number;
  texture: number;
  overall_score: number;
  clinical_scores?: ClinicalScores;
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

type CaptureItem = {
  file: File;
  preview: string;
  label: (typeof FACE_SCAN_CAPTURE_STEPS)[number]["id"];
};

const N_CAPTURES = FACE_SCAN_CAPTURE_STEPS.length;

/** Preview + capture crop zoom (1 = full frame, higher = face closer for the model). */
const CAPTURE_ZOOM_MIN = 1;
const CAPTURE_ZOOM_MAX = 2.5;
const CAPTURE_ZOOM_STEP = 0.1;
const CAPTURE_ZOOM_DEFAULT = 1.35;

export type FaceScanFlowVariant = "dashboard" | "onboarding";

export function FaceScanFlow({ variant }: { variant: FaceScanFlowVariant }) {
  const router = useRouter();
  const isOnboardingScan = variant === "onboarding";
  const [step, setStep] = useState<ScanStep>("upload");
  const [captures, setCaptures] = useState<CaptureItem[]>([]);
  const [scanName, setScanName] = useState(() =>
    variant === "onboarding" ? BASELINE_ONBOARDING_SCAN_NAME : ""
  );
  const [scanResults, setScanResults] = useState<ScanResults | null>(null);
  const [reportOpen, setReportOpen] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [captureZoom, setCaptureZoom] = useState(CAPTURE_ZOOM_DEFAULT);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const primaryPreview = captures[0]?.preview ?? null;

  const revokeAllCaptures = useCallback((items: CaptureItem[]) => {
    items.forEach((c) => URL.revokeObjectURL(c.preview));
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
    setCameraError(null);
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
          "Camera is not available in this browser. Try Chrome, Safari, or Edge, or upload photos instead."
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
          "Could not open the camera. Allow permission in your browser, use HTTPS (or localhost), or upload files instead."
        );
      }
    },
    []
  );

  const openCameraForMultiCapture = useCallback(() => {
    setUploadError(null);
    setCaptureZoom(CAPTURE_ZOOM_DEFAULT);
    setCaptures((prev) => {
      revokeAllCaptures(prev);
      return [];
    });
    void startCamera("user");
  }, [revokeAllCaptures, startCamera]);

  const adjustCaptureZoom = useCallback((delta: number) => {
    setCaptureZoom((z) => {
      const next = Math.round((z + delta) * 10) / 10;
      return Math.min(CAPTURE_ZOOM_MAX, Math.max(CAPTURE_ZOOM_MIN, next));
    });
  }, []);

  const flipCamera = useCallback(() => {
    void startCamera(facingMode === "user" ? "environment" : "user");
  }, [facingMode, startCamera]);

  const captureFromCamera = useCallback(() => {
    const video = videoRef.current;
    if (!video || !streamRef.current) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;
    const maxEdge = 1280;
    let tw = w;
    let th = h;
    if (w > maxEdge || h > maxEdge) {
      if (w >= h) {
        th = Math.round((h * maxEdge) / w);
        tw = maxEdge;
      } else {
        tw = Math.round((w * maxEdge) / h);
        th = maxEdge;
      }
    }
    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Match mirrored selfie preview: flip horizontally for front camera only.
    const mirror = facingMode === "user";
    ctx.save();
    if (mirror) {
      ctx.translate(tw, 0);
      ctx.scale(-1, 1);
    }
    const zoom = captureZoom;
    let sx = 0;
    let sy = 0;
    let sw = w;
    let sh = h;
    if (zoom > 1) {
      sw = w / zoom;
      sh = h / zoom;
      sx = (w - sw) / 2;
      sy = (h - sh) / 2;
    }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, tw, th);
    ctx.restore();
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setCaptures((prev) => {
          if (prev.length >= N_CAPTURES) return prev;
          const step = FACE_SCAN_CAPTURE_STEPS[prev.length];
          const captured = new File(
            [blob],
            `face-scan-${step.id}-${Date.now()}.jpg`,
            { type: "image/jpeg" }
          );
          const preview = URL.createObjectURL(blob);
          const next: CaptureItem[] = [
            ...prev,
            { file: captured, preview, label: step.id },
          ];
          if (next.length >= N_CAPTURES) {
            queueMicrotask(() => {
              stopCamera();
              setStep("confirm");
            });
          }
          return next;
        });
      },
      "image/jpeg",
      0.82
    );
  }, [captureZoom, facingMode, stopCamera]);

  const cancelCamera = useCallback(() => {
    setCaptureZoom(CAPTURE_ZOOM_DEFAULT);
    setCaptures((prev) => {
      revokeAllCaptures(prev);
      return [];
    });
    stopCamera();
  }, [revokeAllCaptures, stopCamera]);

  const applyFileList = useCallback(
    (files: FileList | File[] | null) => {
      if (!files?.length) return;
      const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (arr.length !== N_CAPTURES) {
        setUploadError(
          `Choose exactly ${N_CAPTURES} photos in order (you picked ${arr.length}).`
        );
        return;
      }
      setUploadError(null);
      setCaptures((prev) => {
        revokeAllCaptures(prev);
        return arr.map((file, i) => ({
          file,
          preview: URL.createObjectURL(file),
          label: FACE_SCAN_CAPTURE_STEPS[i].id,
        }));
      });
      setScanResults(null);
      setStep("confirm");
    },
    [revokeAllCaptures]
  );

  const resetScan = useCallback(() => {
    stopCamera();
    setCaptures((prev) => {
      revokeAllCaptures(prev);
      return [];
    });
    setStep("upload");
    setScanName(isOnboardingScan ? BASELINE_ONBOARDING_SCAN_NAME : "");
    setScanResults(null);
    setUploadError(null);
    setScanError(null);
  }, [revokeAllCaptures, stopCamera, isOnboardingScan]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      applyFileList(e.dataTransfer.files);
    },
    [applyFileList]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    applyFileList(e.target.files);
    e.target.value = "";
  };

  const runScan = useCallback(async () => {
    if (captures.length !== N_CAPTURES || !scanName.trim()) return;
    setStep("scanning");
    setScanError(null);
    try {
      const formData = new FormData();
      formData.append("scanName", scanName.trim());
      captures.forEach((c) => formData.append("images", c.file));
      const res = await fetch("/api/scan", {
        method: "POST",
        body: formData,
      });
      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        data?: ScanResults & { id?: number };
      };
      if (!res.ok || !json.success) {
        setScanError(
          json.error ||
            (res.status === 401
              ? "Sign in to save your scan."
              : "Scan failed. Try again.")
        );
        setStep("naming");
        return;
      }
      const scanId = json.data?.id;
      if (typeof scanId === "number" && scanId >= 1) {
        if (isOnboardingScan) {
          router.push(
            `/onboarding/baseline-report?scanId=${encodeURIComponent(String(scanId))}`
          );
          return;
        }
        router.push(`/dashboard/history/scans/${scanId}`);
        return;
      }
      if (json.data) {
        setScanResults(json.data);
        setReportOpen(true);
        setStep("results");
      } else {
        setScanError("Scan saved but no report id returned.");
        setStep("naming");
      }
    } catch {
      setScanError("Network error. Check your connection and try again.");
      setStep("naming");
    }
  }, [captures, scanName, router, variant]);

  const currentCameraStep = FACE_SCAN_CAPTURE_STEPS[Math.min(captures.length, N_CAPTURES - 1)];
  const captureCount = captures.length;

  return (
    <div className="space-y-6">
      <motion.header
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-center text-2xl font-extrabold tracking-tight text-[#2C3E6B]">
          {isOnboardingScan ? "kAI baseline photos" : "AI face scan"}
        </h1>
        <p className="mt-1 text-center text-sm text-[#6B7280]">
          {isOnboardingScan
            ? "Five angles in order — last step of setup. Later check-ins use Scan."
            : "Five angles in order — scores, clinical metrics, and annotated findings."}
        </p>
      </motion.header>

      {/* Step: Upload — live camera (multi-capture) */}
      {step === "upload" && cameraOpen && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 rounded-[22px] border border-white/70 bg-white/35 p-4 backdrop-blur-sm md:p-6"
        >
          <div className="rounded-xl border border-white/60 bg-white/50 px-4 py-3 text-center backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#2C3E6B]/60">
              Step {Math.min(captureCount + 1, N_CAPTURES)} of {N_CAPTURES}
            </p>
            <p className="mt-1 text-base font-bold text-[#2C3E6B]">{currentCameraStep.title}</p>
            <p className="mt-0.5 text-sm text-[#6B7280]">{currentCameraStep.instruction}</p>
          </div>
          <div className="relative mx-auto aspect-[3/4] max-h-[min(70vh,520px)] w-full max-w-md overflow-hidden rounded-2xl bg-zinc-900">
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              style={{
                transformOrigin: "center center",
                transform:
                  facingMode === "user"
                    ? `scaleX(-1) scale(${captureZoom})`
                    : `scale(${captureZoom})`,
              }}
              playsInline
              muted
              autoPlay
              aria-label="Live camera preview (mirrored for front camera)"
            />
            <FaceCaptureOvalOverlayWeb />
            <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-20 rounded-lg bg-zinc-950/55 px-3 py-2 text-center text-xs text-white backdrop-blur-sm">
              {captureCount}/{N_CAPTURES} captured · zoom {captureZoom.toFixed(1)}×
            </div>
          </div>
          <div className="rounded-xl border border-white/60 bg-white/50 px-4 py-3 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[#2C3E6B]">Zoom</p>
              <p className="text-xs tabular-nums text-[#6B7280]">
                {captureZoom.toFixed(1)}× — fill the oval if you are far from the camera
              </p>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => adjustCaptureZoom(-CAPTURE_ZOOM_STEP)}
                disabled={captureZoom <= CAPTURE_ZOOM_MIN}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/70 bg-white/80 text-[#2C3E6B] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Zoom out"
              >
                <ZoomOut className="h-5 w-5" />
              </button>
              <input
                type="range"
                min={CAPTURE_ZOOM_MIN}
                max={CAPTURE_ZOOM_MAX}
                step={CAPTURE_ZOOM_STEP}
                value={captureZoom}
                onChange={(e) => setCaptureZoom(parseFloat(e.target.value))}
                className="min-w-0 flex-1 accent-[#2C3E6B]"
                aria-label="Capture zoom level"
                aria-valuetext={`${captureZoom.toFixed(1)} times`}
              />
              <button
                type="button"
                onClick={() => adjustCaptureZoom(CAPTURE_ZOOM_STEP)}
                disabled={captureZoom >= CAPTURE_ZOOM_MAX}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/70 bg-white/80 text-[#2C3E6B] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Zoom in"
              >
                <ZoomIn className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            <button
              type="button"
              onClick={captureFromCamera}
              disabled={captureCount >= N_CAPTURES}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2C3E6B] py-3.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-[#3d5080] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[200px] sm:flex-1"
            >
              <Camera className="h-5 w-5" />
              Capture
            </button>
            <button
              type="button"
              onClick={flipCamera}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/60 bg-white/50 py-3.5 text-sm font-medium text-[#2C3E6B] backdrop-blur-sm transition-colors hover:bg-white/80 sm:w-auto sm:min-w-[140px]"
              aria-label="Switch between front and back camera"
            >
              <SwitchCamera className="h-5 w-5 text-[#2C3E6B]" />
              Flip camera
            </button>
            <button
              type="button"
              onClick={cancelCamera}
              className="flex w-full items-center justify-center rounded-xl border border-white/60 bg-white/50 py-3.5 text-sm font-medium text-[#6B7280] backdrop-blur-sm transition-colors hover:bg-white/80 sm:w-auto sm:min-w-[120px]"
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
            className={`rounded-[22px] border-2 border-dashed p-10 text-center backdrop-blur-sm transition-colors md:p-12 ${
              isDragging
                ? "border-[#2C3E6B]/60 bg-[#E8EFE6]/80"
                : "border-white/70 bg-white/35"
            }`}
          >
            <input
              id="scan-file-input"
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={handleInputChange}
            />
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E8EFE6]/80">
              <ImagePlus className="h-8 w-8 text-[#2C3E6B]" />
            </div>
            <p className="mb-1 font-bold text-[#2C3E6B]">
              Drop or choose {N_CAPTURES} photos
            </p>
            <p className="mb-6 text-sm text-[#6B7280]">
              Same order as the camera steps: front, left, right, eyes closed, smile — or use the camera.
            </p>
            <label
              htmlFor="scan-file-input"
              className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-white/60 bg-white/60 px-6 py-3 text-sm font-semibold text-[#2C3E6B] backdrop-blur-sm transition-colors hover:bg-white/80"
            >
              Choose photos
            </label>
          </div>

          <div className="flex items-center gap-3 px-1">
            <div className="h-px flex-1 bg-white/60" />
            <span className="text-xs font-medium uppercase tracking-wide text-[#2C3E6B]/40">
              or
            </span>
            <div className="h-px flex-1 bg-white/60" />
          </div>

          <button
            type="button"
            onClick={openCameraForMultiCapture}
            className="flex w-full items-center justify-center gap-2 rounded-[22px] border-2 border-[#2C3E6B]/20 bg-[#E8EFE6]/60 py-4 text-sm font-semibold text-[#2C3E6B] transition-colors hover:bg-[#E8EFE6]"
          >
            <Camera className="h-5 w-5 text-[#2C3E6B]" />
            Use device camera
          </button>

          <p className="rounded-2xl border border-white/60 bg-white/40 px-4 py-3 text-center text-sm text-[#6B7280] backdrop-blur-sm">
            {FACE_SCAN_INSTRUCTIONS_BELOW_CAMERA.join(" ")}
          </p>

          {uploadError ? (
            <p
              className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900"
              role="alert"
            >
              {uploadError}
            </p>
          ) : null}
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
      {step === "confirm" && captures.length === N_CAPTURES && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-[22px] border border-white/70 bg-white/35 p-4 backdrop-blur-sm sm:p-6">
            <p className="mb-4 text-center text-xs font-semibold uppercase tracking-wide text-[#2C3E6B]/60">
              Preview
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
              {captures.map((c, i) => (
                <figure key={`${c.label}-${i}`} className="flex min-w-0 flex-col gap-2">
                  <div className="relative aspect-[3/4] w-full min-h-[140px] overflow-hidden rounded-2xl bg-zinc-100 ring-1 ring-zinc-200/80 sm:min-h-[160px] lg:min-h-0">
                    <img
                      src={c.preview}
                      alt={FACE_SCAN_CAPTURE_STEPS[i].title}
                      className="h-full w-full object-cover object-center"
                    />
                  </div>
                  <figcaption className="line-clamp-2 text-center text-xs font-medium leading-snug text-zinc-600">
                    {FACE_SCAN_CAPTURE_STEPS[i].title}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => {
                setCaptures((prev) => {
                  revokeAllCaptures(prev);
                  return [];
                });
                setStep("upload");
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/60 bg-white/50 py-3 text-sm font-medium text-[#2C3E6B] backdrop-blur-sm transition-colors hover:bg-white/80"
            >
              <RotateCcw className="h-4 w-4" />
              Retake
            </button>
            <button
              type="button"
              onClick={() => setStep("naming")}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#2C3E6B] py-3 text-sm font-medium text-white shadow-md transition-colors hover:bg-[#3d5080]"
            >
              <Check className="h-4 w-4" />
              Looks good
            </button>
          </div>
        </motion.div>
      )}

      {/* Step: Naming */}
      {step === "naming" && primaryPreview && captures.length === N_CAPTURES && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-[22px] border border-white/70 bg-white/35 p-4 backdrop-blur-sm sm:p-6">
            <p className="mb-4 text-center text-xs font-semibold uppercase tracking-wide text-[#2C3E6B]/60">
              Photo in this scan
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
              {captures.map((c, i) => (
                <div
                  key={`thumb-${c.label}-${i}`}
                  className="relative aspect-[3/4] w-full min-h-[140px] overflow-hidden rounded-2xl bg-zinc-100 ring-1 ring-zinc-200/80 sm:min-h-[160px] lg:min-h-0"
                >
                  <img
                    src={c.preview}
                    alt=""
                    className="h-full w-full object-cover object-center grayscale-[15%]"
                  />
                </div>
              ))}
            </div>
          </div>
          {scanError ? (
            <p
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-center text-sm text-rose-900"
              role="alert"
            >
              {scanError}
            </p>
          ) : null}
          <div className="rounded-[22px] border border-white/70 bg-white/35 p-6 backdrop-blur-sm">
            <label htmlFor="scan-name" className="mb-3 block text-sm font-medium text-[#2C3E6B]">
              Name this scan
            </label>
            <input
              id="scan-name"
              type="text"
              placeholder="e.g., Morning routine"
              value={scanName}
              onChange={(e) => setScanName(e.target.value)}
              className="w-full rounded-xl border border-white/60 bg-white/50 px-4 py-3 text-[#2C3E6B] placeholder:text-[#2C3E6B]/40 backdrop-blur-sm focus:border-[#2C3E6B]/40 focus:outline-none focus:ring-2 focus:ring-[#2C3E6B]/10"
            />
          </div>
          <button
            type="button"
            onClick={runScan}
            disabled={!scanName.trim()}
            className="w-full rounded-xl bg-[#2C3E6B] py-3 text-sm font-medium text-white shadow-md transition-colors hover:bg-[#3d5080] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Start analysis
          </button>
        </motion.div>
      )}

      {/* Step: Scanning */}
      {step === "scanning" && primaryPreview && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <div className="relative overflow-hidden rounded-[22px] border border-white/70 bg-white/35 backdrop-blur-sm">
            <div className="relative aspect-[3/4] max-h-[400px] w-full">
              <img
                src={primaryPreview}
                alt="Scanning"
                className="h-full w-full object-cover grayscale-[30%]"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/85 backdrop-blur-sm">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#2C3E6B]/30 border-t-[#2C3E6B]"
                >
                  <Sparkles className="h-6 w-6 text-[#2C3E6B]" />
                </motion.div>
                <p className="text-lg font-bold text-[#2C3E6B]">Scanning…</p>
                <p className="mt-1 text-sm text-[#6B7280]">AI is analyzing your photo…</p>
                <motion.div
                  className="absolute left-0 right-0 z-10 h-1 bg-[#2C3E6B] shadow-[0_0_16px_rgba(44,62,107,0.4)]"
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
      {step === "results" && scanResults && primaryPreview && (
        <>
          <SkinScanReportModal
            open={reportOpen}
            onClose={() => setReportOpen(false)}
            userName={scanResults.userName?.trim() || "there"}
            imageUrl={primaryPreview}
            faceCaptureGallery={captures.map((c, i) => ({
              label: FACE_SCAN_CAPTURE_STEPS[i].title,
              imageUrl: c.preview,
            }))}
            regions={scanResults.detected_regions}
            metrics={{
              acne: scanResults.metrics.acne,
              hydration: scanResults.metrics.hydration,
              wrinkles: scanResults.metrics.wrinkles,
              overall_score: scanResults.metrics.overall_score,
              pigmentation: scanResults.metrics.pigmentation,
              texture: scanResults.metrics.texture,
              clinical_scores: scanResults.metrics.clinical_scores,
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
              className="rounded-[22px] border border-white/70 bg-white/35 p-8 text-center backdrop-blur-sm"
            >
              <p className="text-sm font-medium text-[#6B7280]">
                Report saved to your history. Start another scan whenever you
                like.
              </p>
              <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  onClick={() => setReportOpen(true)}
                  className="w-full rounded-xl border border-white/60 bg-white/50 px-6 py-3 text-sm font-semibold text-[#2C3E6B] backdrop-blur-sm transition hover:bg-white/80 sm:w-auto"
                >
                  View report again
                </button>
                <button
                  type="button"
                  onClick={resetScan}
                  className="w-full rounded-xl bg-[#2C3E6B] px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#3d5080] sm:w-auto"
                >
                  Scan again
                </button>
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
