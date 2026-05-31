"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Camera,
  Sparkles,
  RotateCcw,
  Check,
  ImagePlus,
  SwitchCamera,
  Sun,
  Contrast,
  ZoomIn,
  History,
  Volume2,
  VolumeX,
  Bug,
} from "lucide-react";
import { SkinScanReportModal } from "@/components/dashboard/SkinScanReportModal";
import { ScanCaptureGuidanceBanner } from "@/components/dashboard/ScanCaptureGuidanceBanner";
import {
  ScanCaptureDebugOverlay,
} from "@/components/dashboard/ScanCaptureDebugOverlay";
import { useWebScanCaptureGuidance } from "@/src/hooks/useWebScanCaptureGuidance";
import {
  CAPTURE_READY_VOICE_HINT,
  captureVoiceGuide,
} from "@/src/lib/captureVoiceGuide";
import { CAPTURE_ZOOM_AUTO } from "@/src/lib/scanCaptureGuidance";
import {
  patientSecondaryBtn,
} from "@/src/lib/patientDashboardTheme";
import {
  FACE_SCAN_CAPTURE_STEPS,
  FACE_SCAN_INSTRUCTIONS_BELOW_CAMERA,
  SCAN_NAME_INPUT_PLACEHOLDER,
  resolveScanName,
} from "@/src/lib/faceScanCaptures";
import { BASELINE_ONBOARDING_SCAN_NAME } from "@/src/lib/onboardingConstants";
import { ScanQueuedConfirmation } from "@/components/dashboard/ScanQueuedConfirmation";
import { addPendingScanJob } from "@/src/lib/scanJobNotifications";
import { submitFaceScan } from "@/src/lib/submitFaceScan";

type ScanStep = "upload" | "confirm" | "naming" | "scanning" | "queued" | "results";

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

type PendingCapture = CaptureItem;

const N_CAPTURES = FACE_SCAN_CAPTURE_STEPS.length;

/** Fixed 3:4 preview — explicit px so grid column cannot stretch it taller. */
const CAMERA_PREVIEW_CLASS =
  "relative mx-auto h-[210px] w-[158px] shrink-0 overflow-hidden rounded-2xl bg-zinc-900 sm:h-[228px] sm:w-[171px] lg:mx-0";

/** Preview + capture crop zoom (1 = full frame, higher = face closer for the model). */
const CAPTURE_ZOOM_MIN = CAPTURE_ZOOM_AUTO.min;
const CAPTURE_ZOOM_MAX = CAPTURE_ZOOM_AUTO.max;
const CAPTURE_ZOOM_STEP = 0.1;
const CAPTURE_ZOOM_DEFAULT = CAPTURE_ZOOM_AUTO.default;

/** Brightness / contrast are percentages baked into the preview + captured photo. */
const ADJUST_MIN = 50;
const ADJUST_MAX = 150;
const ADJUST_STEP = 1;
const ADJUST_DEFAULT = 100;

function AdjustSlider({
  icon,
  label,
  value,
  min,
  max,
  step,
  suffix,
  format,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex w-24 shrink-0 items-center gap-1.5 text-xs font-semibold text-[#2C3E6B]">
        {icon}
        {label}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="min-w-0 flex-1 accent-[#2C3E6B]"
        aria-label={label}
      />
      <span className="w-12 shrink-0 text-right text-xs font-semibold tabular-nums text-[#2C3E6B]">
        {format ? format(value) : Math.round(value)}
        {suffix}
      </span>
    </div>
  );
}

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
  const [captureZoom, setCaptureZoom] = useState<number>(CAPTURE_ZOOM_DEFAULT);
  const [brightness, setBrightness] = useState<number>(ADJUST_DEFAULT);
  const [contrast, setContrast] = useState<number>(ADJUST_DEFAULT);
  const [pendingCapture, setPendingCapture] = useState<PendingCapture | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureStepIndexRef = useRef(0);
  const currentCameraStep = FACE_SCAN_CAPTURE_STEPS[Math.min(captures.length, N_CAPTURES - 1)];
  const reviewingCapture = pendingCapture != null;
  const guidanceActive = cameraOpen && !reviewingCapture;

  const { guidance, models, needsExpressionModel, faceTracked, bboxSource } =
    useWebScanCaptureGuidance(
      videoRef,
      guidanceActive,
      captureZoom,
      currentCameraStep.id
    );

  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [showDebug, setShowDebug] = useState(true);

  const debugExtra = {
    step: `${Math.min(captures.length + 1, N_CAPTURES)}/${N_CAPTURES}`,
    bbox: bboxSource,
  };

  const previewFilter = `brightness(${brightness}%) contrast(${contrast}%)`;
  const adjustmentsChanged =
    brightness !== ADJUST_DEFAULT || contrast !== ADJUST_DEFAULT;

  const resetAdjustments = useCallback(() => {
    setBrightness(ADJUST_DEFAULT);
    setContrast(ADJUST_DEFAULT);
  }, []);

  useEffect(() => {
    captureVoiceGuide.setEnabled(voiceEnabled && cameraOpen);
    if (!voiceEnabled || !cameraOpen) captureVoiceGuide.reset();
    return () => {
      captureVoiceGuide.setEnabled(false);
    };
  }, [voiceEnabled, cameraOpen]);

  useEffect(() => {
    captureVoiceGuide.reset();
  }, [currentCameraStep.id]);

  /** Speak the highest-priority guidance line (debounced/cooldown'd inside). */
  useEffect(() => {
    if (!voiceEnabled || !cameraOpen || reviewingCapture || !guidance) return;
    if (guidance.face === "no_face") {
      captureVoiceGuide.speak(guidance.faceMessage, "critical");
      return;
    }
    if (guidance.face !== "good") {
      captureVoiceGuide.speak(guidance.faceMessage, "framing");
      return;
    }
    if (guidance.expressionMessage && guidance.expressionOk === false) {
      captureVoiceGuide.speak(guidance.expressionMessage, "expression");
      return;
    }
    const lightingOk =
      guidance.lighting === "good" || guidance.lightingScore >= 55;
    if (!lightingOk) {
      captureVoiceGuide.speak(guidance.lightingMessage, "lighting");
      return;
    }
    if (guidance.readyToCapture) {
      captureVoiceGuide.speak(CAPTURE_READY_VOICE_HINT, "ready");
    }
  }, [voiceEnabled, cameraOpen, reviewingCapture, guidance]);

  useEffect(() => {
    captureStepIndexRef.current = captures.length;
  }, [captures.length]);

  const clearPendingCapture = useCallback((item: PendingCapture | null) => {
    if (item?.preview) URL.revokeObjectURL(item.preview);
  }, []);

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
    resetAdjustments();
    setPendingCapture((prev) => {
      clearPendingCapture(prev);
      return null;
    });
    setCaptures((prev) => {
      revokeAllCaptures(prev);
      return [];
    });
    void startCamera("user");
  }, [revokeAllCaptures, startCamera, clearPendingCapture, resetAdjustments]);

  const setCaptureZoomManual = useCallback((value: number) => {
    setCaptureZoom(value);
  }, []);

  const flipCamera = useCallback(() => {
    void startCamera(facingMode === "user" ? "environment" : "user");
  }, [facingMode, startCamera]);

  const captureFromCamera = useCallback(() => {
    const video = videoRef.current;
    if (!video || !streamRef.current || pendingCapture) return;
    const stepIndex = captureStepIndexRef.current;
    if (stepIndex >= N_CAPTURES) return;
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
    // Bake the same brightness/contrast the user sees in the preview.
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
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
        const idx = captureStepIndexRef.current;
        if (idx >= N_CAPTURES) return;
        const step = FACE_SCAN_CAPTURE_STEPS[idx];
        const captured = new File(
          [blob],
          `face-scan-${step.id}-${Date.now()}.jpg`,
          { type: "image/jpeg" }
        );
        const preview = URL.createObjectURL(blob);
        setPendingCapture((prev) => {
          clearPendingCapture(prev);
          return { file: captured, preview, label: step.id };
        });
      },
      "image/jpeg",
      0.82
    );
  }, [captureZoom, brightness, contrast, facingMode, pendingCapture, clearPendingCapture]);

  const confirmPendingCapture = useCallback(() => {
    if (!pendingCapture) return;
    const item = pendingCapture;
    setPendingCapture(null);
    setCaptures((prev) => {
      if (prev.length >= N_CAPTURES) return prev;
      const next = [...prev, item];
      if (next.length >= N_CAPTURES) {
        queueMicrotask(() => {
          stopCamera();
          setStep("confirm");
        });
      }
      return next;
    });
  }, [pendingCapture, stopCamera]);

  const retakePendingCapture = useCallback(() => {
    setPendingCapture((prev) => {
      clearPendingCapture(prev);
      return null;
    });
  }, [clearPendingCapture]);

  const cancelCamera = useCallback(() => {
    setCaptureZoom(CAPTURE_ZOOM_DEFAULT);
    resetAdjustments();
    setPendingCapture((prev) => {
      clearPendingCapture(prev);
      return null;
    });
    setCaptures((prev) => {
      revokeAllCaptures(prev);
      return [];
    });
    stopCamera();
  }, [revokeAllCaptures, stopCamera, clearPendingCapture, resetAdjustments]);

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
    setPendingCapture((prev) => {
      clearPendingCapture(prev);
      return null;
    });
    setCaptures((prev) => {
      revokeAllCaptures(prev);
      return [];
    });
    setStep("upload");
    setScanName(isOnboardingScan ? BASELINE_ONBOARDING_SCAN_NAME : "");
    setScanResults(null);
    setUploadError(null);
    setScanError(null);
  }, [revokeAllCaptures, stopCamera, isOnboardingScan, clearPendingCapture]);

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
    if (captures.length !== N_CAPTURES) return;
    const finalScanName = resolveScanName(scanName);
    setStep("scanning");
    setScanError(null);
    try {
      const formData = new FormData();
      formData.append("scanName", finalScanName);
      captures.forEach((c) => formData.append("images", c.file));
      const outcome = await submitFaceScan(formData);

      if (outcome.mode === "queued") {
        addPendingScanJob(outcome.jobId, finalScanName);
        setStep("queued");
        return;
      }

      if (outcome.mode === "error") {
        setScanError(outcome.message);
        setStep("naming");
        return;
      }

      const scanId = outcome.scanId;
      if (isOnboardingScan) {
        router.push(
          `/onboarding/baseline-report?scanId=${encodeURIComponent(String(scanId))}`
        );
        return;
      }
      router.push(`/dashboard/history/scans/${scanId}`);
    } catch {
      setScanError("Network error. Check your connection and try again.");
      setStep("naming");
    }
  }, [captures, scanName, router, isOnboardingScan]);

  const captureCount = captures.length;

  return (
    <div className="space-y-6">
      <motion.header
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mx-auto max-w-4xl"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#2C3E6B]/60">
              Skin analysis
            </p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#1F2A44]">
              {isOnboardingScan ? "kAI baseline photos" : "AI face scan"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#64748B]">
              {isOnboardingScan
                ? "Five angles in order — last step of setup. Later check-ins use Scan."
                : "Five angles in order — scores, clinical metrics, and annotated findings."}
            </p>
          </div>
          {!isOnboardingScan ? (
            <Link
              href="/dashboard/history"
              className={`shrink-0 self-center sm:self-start ${patientSecondaryBtn}`}
            >
              <History className="h-4 w-4" aria-hidden />
              Scan history
            </Link>
          ) : null}
        </div>
      </motion.header>

      {/* Step: Upload — live camera (multi-capture) */}
      {step === "upload" && cameraOpen && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto w-full max-w-5xl rounded-[22px] border border-white/70 bg-white/35 p-4 backdrop-blur-sm md:p-6"
        >
          <div className="grid gap-5 lg:grid-cols-[auto_minmax(0,340px)] lg:items-start">
            {/* Left: live camera + capture actions */}
            <div className="flex min-w-0 flex-col items-center gap-3 lg:items-start">
              <div className={CAMERA_PREVIEW_CLASS}>
                <video
                  ref={videoRef}
                  className={`h-full w-full object-cover ${reviewingCapture ? "invisible" : ""}`}
                  style={{
                    transformOrigin: "center center",
                    transform:
                      facingMode === "user"
                        ? `scaleX(-1) scale(${captureZoom})`
                        : `scale(${captureZoom})`,
                    filter: previewFilter,
                  }}
                  playsInline
                  muted
                  autoPlay
                  aria-label="Live camera preview (mirrored for front camera)"
                />
                {pendingCapture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pendingCapture.preview}
                    alt={`Captured ${currentCameraStep.title}`}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : null}
                <div className="pointer-events-none absolute bottom-2 left-1/2 z-30 -translate-x-1/2 rounded-full bg-zinc-950/55 px-3 py-1 text-[11px] font-medium text-white">
                  {captureCount}/{N_CAPTURES}
                  {reviewingCapture
                    ? " · review photo"
                    : guidance?.readyToCapture
                      ? " · ready"
                      : ""}
                </div>
                {!reviewingCapture ? (
                  <div className="absolute right-2 top-2 z-30 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDebug((v) => !v)}
                      className={`flex h-9 w-9 items-center justify-center rounded-full backdrop-blur transition-colors ${
                        showDebug
                          ? "bg-emerald-600 text-white"
                          : "bg-white/70 text-[#2C3E6B] hover:bg-white"
                      }`}
                      aria-pressed={showDebug}
                      aria-label={showDebug ? "Hide capture debug" : "Show capture debug"}
                      title={showDebug ? "Hide capture debug" : "Show capture debug"}
                    >
                      <Bug className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setVoiceEnabled((v) => !v)}
                      className={`flex h-9 w-9 items-center justify-center rounded-full backdrop-blur transition-colors ${
                        voiceEnabled
                          ? "bg-[#2C3E6B] text-white"
                          : "bg-white/70 text-[#2C3E6B] hover:bg-white"
                      }`}
                      aria-pressed={voiceEnabled}
                      aria-label={voiceEnabled ? "Mute voice guide" : "Enable voice guide"}
                      title={voiceEnabled ? "Mute voice guide" : "Enable voice guide"}
                    >
                      {voiceEnabled ? (
                        <Volume2 className="h-4 w-4" />
                      ) : (
                        <VolumeX className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="flex w-full max-w-[280px] flex-col gap-2 sm:flex-row">
                {reviewingCapture ? (
                  <>
                    <button
                      type="button"
                      onClick={retakePendingCapture}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/60 bg-white/50 py-3.5 text-sm font-semibold text-[#2C3E6B] backdrop-blur-sm transition-colors hover:bg-white/80 sm:flex-1"
                    >
                      <RotateCcw className="h-5 w-5" />
                      Retake
                    </button>
                    <button
                      type="button"
                      onClick={confirmPendingCapture}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2C3E6B] py-3.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-[#3d5080] sm:flex-[1.4]"
                    >
                      <Check className="h-5 w-5" />
                      {captureCount + 1 >= N_CAPTURES ? "Use photo & finish" : "Use photo & next"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={captureFromCamera}
                      disabled={captureCount >= N_CAPTURES}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2C3E6B] py-3.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-[#3d5080] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-[1.4]"
                    >
                      <Camera className="h-5 w-5" />
                      Capture
                    </button>
                    <button
                      type="button"
                      onClick={flipCamera}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/60 bg-white/50 py-3.5 text-sm font-medium text-[#2C3E6B] backdrop-blur-sm transition-colors hover:bg-white/80 sm:flex-1"
                      aria-label="Switch between front and back camera"
                    >
                      <SwitchCamera className="h-5 w-5 text-[#2C3E6B]" />
                      Flip
                    </button>
                    <button
                      type="button"
                      onClick={cancelCamera}
                      className="flex w-full items-center justify-center rounded-xl border border-white/60 bg-white/50 py-3.5 text-sm font-medium text-[#6B7280] backdrop-blur-sm transition-colors hover:bg-white/80 sm:flex-1"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Right: step guidance + manual adjustments */}
            <aside className="flex flex-col gap-3">
              <div className="rounded-xl border border-white/60 bg-white/55 px-3 py-3 text-center backdrop-blur-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#2C3E6B]/60">
                  Step {Math.min(captureCount + 1, N_CAPTURES)} of {N_CAPTURES}
                </p>
                <p className="mt-0.5 text-lg font-bold text-[#2C3E6B]">
                  {currentCameraStep.title}
                </p>
                <p className="mt-0.5 text-sm leading-snug text-[#6B7280]">
                  {reviewingCapture
                    ? "Use this photo or retake it."
                    : currentCameraStep.instruction}
                </p>
              </div>

              {reviewingCapture ? (
                <div className="rounded-xl border border-[#2C3E6B]/20 bg-[#E8EFE6]/80 px-3 py-2.5 text-center text-sm text-[#374151]">
                  Review this photo. Continue to the next angle or retake.
                </div>
              ) : (
                <div className="rounded-xl border border-white/60 bg-white/55 px-3 py-3 backdrop-blur-sm">
                  <ScanCaptureGuidanceBanner
                    guidance={guidance}
                    models={models}
                    needsExpressionModel={needsExpressionModel}
                    compact
                  />
                </div>
              )}

              <div
                className={`flex flex-col gap-3 rounded-xl border border-white/60 bg-white/50 px-3 py-3 backdrop-blur-sm ${
                  reviewingCapture ? "pointer-events-none opacity-50" : ""
                }`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#2C3E6B]/60">
                  Adjust
                </p>
                <AdjustSlider
                  icon={<Sun className="h-4 w-4 text-[#2C3E6B]/70" />}
                  label="Brightness"
                  value={brightness}
                  min={ADJUST_MIN}
                  max={ADJUST_MAX}
                  step={ADJUST_STEP}
                  suffix="%"
                  onChange={setBrightness}
                />
                <AdjustSlider
                  icon={<Contrast className="h-4 w-4 text-[#2C3E6B]/70" />}
                  label="Contrast"
                  value={contrast}
                  min={ADJUST_MIN}
                  max={ADJUST_MAX}
                  step={ADJUST_STEP}
                  suffix="%"
                  onChange={setContrast}
                />
                <AdjustSlider
                  icon={<ZoomIn className="h-4 w-4 text-[#2C3E6B]/70" />}
                  label="Zoom"
                  value={captureZoom}
                  min={CAPTURE_ZOOM_MIN}
                  max={CAPTURE_ZOOM_MAX}
                  step={CAPTURE_ZOOM_STEP}
                  suffix="×"
                  format={(v) => v.toFixed(1)}
                  onChange={setCaptureZoomManual}
                />
                {adjustmentsChanged ? (
                  <button
                    type="button"
                    onClick={resetAdjustments}
                    className="self-end text-xs font-medium text-[#2C3E6B]/70 underline-offset-2 hover:underline"
                  >
                    Reset brightness & contrast
                  </button>
                ) : null}
              </div>

              {!reviewingCapture && showDebug ? (
                <ScanCaptureDebugOverlay
                  guidance={guidance}
                  captureZoom={captureZoom}
                  models={models}
                  faceTracked={faceTracked}
                  visible
                  variant="panel"
                  extra={debugExtra}
                />
              ) : null}
            </aside>
          </div>
        </motion.div>
      )}

      {step === "upload" && !cameraOpen && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mx-auto w-full max-w-4xl"
        >
          <div className="overflow-hidden rounded-[28px] border border-white/75 bg-white/45 p-4 shadow-[0_18px_50px_-28px_rgba(44,62,107,0.5)] backdrop-blur-sm md:p-6">
            <div className="grid gap-4 md:grid-cols-[1.05fr_0.95fr]">
              <button
                type="button"
                onClick={openCameraForMultiCapture}
                className="group relative overflow-hidden rounded-[24px] bg-[#2C3E6B] p-6 text-left text-white shadow-[0_18px_40px_-22px_rgba(44,62,107,0.8)] transition hover:-translate-y-0.5 hover:bg-[#354A7A] focus:outline-none focus:ring-2 focus:ring-[#2C3E6B]/30"
              >
                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10" />
                <div className="pointer-events-none absolute bottom-0 right-0 h-24 w-24 rounded-tl-full bg-emerald-400/15" />
                <div className="relative">
                  <span className="inline-flex items-center rounded-full bg-white/14 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/80">
                    Recommended
                  </span>
                  <div className="mt-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 shadow-inner">
                    <Camera className="h-7 w-7" />
                  </div>
                  <h2 className="mt-5 text-2xl font-extrabold tracking-tight">
                    Use device camera
                  </h2>
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/75">
                    Guided capture keeps the five angles in order and reduces upload mistakes.
                  </p>
                  <span className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-extrabold text-[#2C3E6B] shadow-sm transition group-hover:bg-[#F8FAFC]">
                    Start camera scan
                    <Camera className="h-4 w-4" />
                  </span>
                </div>
              </button>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`flex min-h-[270px] flex-col justify-between rounded-[24px] border-2 border-dashed p-5 text-center transition-colors ${
                  isDragging
                    ? "border-[#2C3E6B]/60 bg-[#E8EFE6]/85"
                    : "border-white/80 bg-white/45"
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
                <div>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8EFE6] shadow-sm">
                    <ImagePlus className="h-6 w-6 text-[#2C3E6B]" />
                  </div>
                  <h2 className="mt-4 text-lg font-extrabold text-[#1F2A44]">
                    Upload photos
                  </h2>
                  <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-[#64748B]">
                    Already captured them? Drop or choose exactly {N_CAPTURES} clear photos.
                  </p>
                </div>
                <label
                  htmlFor="scan-file-input"
                  className="mt-6 inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/70 bg-white/75 px-5 py-3 text-sm font-extrabold text-[#2C3E6B] shadow-sm transition hover:bg-white"
                >
                  <ImagePlus className="h-4 w-4" />
                  Choose photos
                </label>
              </div>
            </div>

            <div className="mt-5 rounded-[22px] border border-white/70 bg-white/45 p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#2C3E6B]/60">
                Capture checklist
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-5">
                {FACE_SCAN_CAPTURE_STEPS.map((captureStep, index) => (
                  <div
                    key={captureStep.id}
                    className="rounded-2xl border border-white/70 bg-white/55 px-3 py-2 text-center"
                  >
                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#94A3B8]">
                      {index + 1}
                    </p>
                    <p className="mt-0.5 text-xs font-bold text-[#2C3E6B]">
                      {captureStep.title}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-center text-sm leading-relaxed text-[#64748B]">
                {FACE_SCAN_INSTRUCTIONS_BELOW_CAMERA.join(" ")}
              </p>
            </div>
          </div>

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
              placeholder={SCAN_NAME_INPUT_PLACEHOLDER}
              value={scanName}
              onChange={(e) => setScanName(e.target.value)}
              className="w-full rounded-xl border border-white/60 bg-white/50 px-4 py-3 text-[#2C3E6B] placeholder:text-[#2C3E6B]/40 backdrop-blur-sm focus:border-[#2C3E6B]/40 focus:outline-none focus:ring-2 focus:ring-[#2C3E6B]/10"
            />
            <p className="mt-2 text-xs text-[#6B7280]">
              Leave blank to save as &quot;{resolveScanName("")}&quot;.
            </p>
          </div>
          <button
            type="button"
            onClick={runScan}
            className="w-full rounded-xl bg-[#2C3E6B] py-3 text-sm font-medium text-white shadow-md transition-colors hover:bg-[#3d5080]"
          >
            Start analysis
          </button>
        </motion.div>
      )}

      {/* Step: Scanning */}
      {step === "queued" && (
        <ScanQueuedConfirmation variant={variant} />
      )}

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
                <p className="text-lg font-bold text-[#2C3E6B]">Submitting your scan…</p>
                <p className="mt-1 text-sm text-[#6B7280]">Just a moment</p>
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
