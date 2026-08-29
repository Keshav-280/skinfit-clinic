"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Camera,
  Sparkles,
  RotateCcw,
  Check,
  ImagePlus,
  Sun,
  ZoomIn,
  X,
  History,
  Smartphone,
  ArrowRight,
  Leaf,
} from "lucide-react";
import { SkinScanReportModal } from "@/components/dashboard/SkinScanReportModal";
import { CaptureFaceGuideOverlayWeb } from "@/components/dashboard/CaptureFaceGuideOverlayWeb";
import { ScanCaptureExtraTipsPanel } from "@/components/dashboard/ScanCaptureExtraTipsPanel";
import {
  WebCaptureShutterControls,
  WebCaptureStepShell,
} from "@/components/dashboard/WebCaptureStepShell";
import {
  ScanCaptureDebugOverlay,
  isCaptureDebugEnabled,
} from "@/components/dashboard/ScanCaptureDebugOverlay";
import { useWebScanCaptureGuidance } from "@/src/hooks/useWebScanCaptureGuidance";
import { captureVoiceGuide } from "@/src/lib/captureVoiceGuide";
import {
  loadStoredCaptureVoiceVolume,
  resolveCaptureVoiceHint,
  storeCaptureVoiceVolume,
} from "@/src/lib/captureVoiceHint";
import { CAPTURE_ZOOM_AUTO } from "@/src/lib/scanCaptureGuidance";
import {
  FACE_SCAN_CAPTURE_STEPS,
  buildAutoScanName,
  fetchNextScanNumber,
  SCAN_NAME_INPUT_PLACEHOLDER,
  resolveScanName,
} from "@/src/lib/faceScanCaptures";
import { BASELINE_ONBOARDING_SCAN_NAME } from "@/src/lib/onboardingConstants";
import { SKINFIT_THEME } from "@/src/lib/skinfitTheme";
import { FaceScanPhotoGuide } from "@/components/dashboard/FaceScanPhotoGuide";
import { FaceIdentityCheckResults } from "@/components/onboarding/FaceIdentityCheckResults";
import { ScanQueuedConfirmation } from "@/components/dashboard/ScanQueuedConfirmation";
import { MobileCaptureQRPanel } from "@/components/dashboard/MobileCaptureQRPanel";
import { addPendingScanJob } from "@/src/lib/scanJobNotifications";
import { submitFaceScan } from "@/src/lib/submitFaceScan";
import type { FaceIdentityImageCheck } from "@/src/lib/scanFaceIdentityGate";
import { ScanPhotoGuideDismissCheckbox } from "@/components/dashboard/ScanPhotoGuideDismissCheckbox";
import { loadRemoteCaptureSlots } from "@/src/lib/loadRemoteCaptureSlots";
import { appendCaptureCropContext } from "@/src/lib/parseCaptureCropContext";
import type { CaptureCropContext } from "@/src/lib/cropScanImageForMl";
import {
  clearScanPhotoGuideDismissed,
  isScanPhotoGuideDismissed,
  setScanPhotoGuideDismissed,
} from "@/src/lib/scanPhotoGuideDismissed";
import {
  getVisibleVideoRect,
  shouldCropToFaceGuide,
  viewfinderCaptureDimensions,
} from "@/src/lib/faceGuideCrop";

type ScanStep =
  | "upload"
  | "confirm"
  | "naming"
  | "scanning"
  | "queued"
  | "results"
  | "phone-qr"
  | "handoff-sent";

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

type MobileCaptureImageRef = {
  label: string;
  imageUrl: string;
  previewUrl?: string;
};

type PendingCapture = CaptureItem;

const N_CAPTURES = FACE_SCAN_CAPTURE_STEPS.length;

type SlotCaptures = (CaptureItem | null)[];

function emptySlotCaptures(): SlotCaptures {
  return Array.from({ length: N_CAPTURES }, () => null);
}

function filledSlotCount(slots: SlotCaptures): number {
  return slots.filter(Boolean).length;
}

function allSlotsFilled(slots: SlotCaptures): boolean {
  return slots.every(Boolean);
}

function firstEmptySlotIndex(slots: SlotCaptures): number {
  const idx = slots.findIndex((s) => !s);
  return idx < 0 ? N_CAPTURES : idx;
}

function revokeSlotCaptures(slots: SlotCaptures) {
  slots.forEach((c) => {
    if (c) URL.revokeObjectURL(c.preview);
  });
}

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
  compact = false,
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
  compact?: boolean;
  onChange: (v: number) => void;
}) {
  const display = `${format ? format(value) : Math.round(value)}${suffix ?? ""}`;

  if (compact) {
    return (
      <div className="space-y-0.5">
        <div className="flex items-center justify-between gap-1 text-[10px] font-semibold text-[#1E1B31]">
          <span className="flex min-w-0 items-center gap-1 truncate">
            {icon}
            {label}
          </span>
          <span className="shrink-0 tabular-nums">{display}</span>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="h-1 w-full accent-[#1E1B31]"
          aria-label={label}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex w-24 shrink-0 items-center gap-1.5 text-xs font-semibold text-[#1E1B31]">
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
        className="min-w-0 flex-1 accent-[#1E1B31]"
        aria-label={label}
      />
      <span className="w-12 shrink-0 text-right text-xs font-semibold tabular-nums text-[#1E1B31]">
        {display}
      </span>
    </div>
  );
}

export type FaceScanFlowVariant = "dashboard" | "onboarding";

export function FaceScanFlow({
  variant,
  onLayoutExpanded,
}: {
  variant: FaceScanFlowVariant;
  /** When true, parent should expand to full-width flow (camera / confirm / etc.). */
  onLayoutExpanded?: (expanded: boolean) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionIdParam = searchParams.get("s");
  const tokenParam = searchParams.get("t");
  const autoCameraParam = searchParams.get("autoCamera");
  const isMobileHandoff = Boolean(sessionIdParam && tokenParam);
  const isOnboardingScan = variant === "onboarding";
  const [step, setStep] = useState<ScanStep>("upload");
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [showDeviceUpload, setShowDeviceUpload] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isMobile =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent,
        ) || navigator.maxTouchPoints > 0;
      setIsMobileDevice(isMobile);
    }
  }, []);

  const [photoGuideOpen, setPhotoGuideOpen] = useState(
    () => variant === "onboarding",
  );
  const [onboardingGuideComplete, setOnboardingGuideComplete] = useState(false);
  const [photoGuideIntent, setPhotoGuideIntent] = useState<"camera" | "review">(
    () => (variant === "onboarding" ? "review" : "camera"),
  );
  const [skipPhotoGuide, setSkipPhotoGuide] = useState(false);
  const [slotCaptures, setSlotCaptures] =
    useState<SlotCaptures>(emptySlotCaptures);
  const [cameraStepIndex, setCameraStepIndex] = useState(0);
  const [uploadTargetIndex, setUploadTargetIndex] = useState<number | null>(
    null,
  );
  const slotUploadInputRef = useRef<HTMLInputElement>(null);
  const [scanName, setScanName] = useState(() =>
    variant === "onboarding" ? BASELINE_ONBOARDING_SCAN_NAME : "",
  );
  const [scanResults, setScanResults] = useState<ScanResults | null>(null);
  const [completedHandoffScanId, setCompletedHandoffScanId] = useState<
    number | null
  >(null);
  const [reportOpen, setReportOpen] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [handoffSending, setHandoffSending] = useState(false);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const [qrSessionId, setQrSessionId] = useState<string | null>(null);
  const [qrCropContext, setQrCropContext] =
    useState<CaptureCropContext | null>(null);
  const handoffViewfinderRef = useRef<{ w: number; h: number } | null>(null);
  const [identityChecks, setIdentityChecks] = useState<
    FaceIdentityImageCheck[] | null
  >(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [captureZoom, setCaptureZoom] = useState<number>(CAPTURE_ZOOM_DEFAULT);
  const [brightness, setBrightness] = useState<number>(ADJUST_DEFAULT);
  const [contrast, setContrast] = useState<number>(ADJUST_DEFAULT);
  const [pendingCapture, setPendingCapture] = useState<PendingCapture | null>(
    null,
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const currentCameraStep =
    FACE_SCAN_CAPTURE_STEPS[Math.min(cameraStepIndex, N_CAPTURES - 1)];
  const reviewingCapture = pendingCapture != null;
  const guidanceActive = cameraOpen && !reviewingCapture;

  const previewFilter = `brightness(${brightness}%) contrast(${contrast}%)`;

  const { guidance, models, faceTracked, bboxSource } =
    useWebScanCaptureGuidance(
      videoRef,
      guidanceActive,
      captureZoom,
      currentCameraStep.id,
      previewFilter,
      tokenParam,
    );

  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceVolume, setVoiceVolume] = useState(() =>
    loadStoredCaptureVoiceVolume(),
  );
  const captureDebugUi = isCaptureDebugEnabled();
  const [showDebug, setShowDebug] = useState(false);

  const debugExtra = {
    step: `${Math.min(cameraStepIndex + 1, N_CAPTURES)}/${N_CAPTURES}`,
    bbox: bboxSource,
  };
  const adjustmentsChanged =
    brightness !== ADJUST_DEFAULT || contrast !== ADJUST_DEFAULT;

  const resetAdjustments = useCallback(() => {
    setBrightness(ADJUST_DEFAULT);
    setContrast(ADJUST_DEFAULT);
  }, []);

  useEffect(() => {
    setSkipPhotoGuide(isScanPhotoGuideDismissed());
  }, []);

  useEffect(() => {
    captureVoiceGuide.setVolume(voiceVolume);
    storeCaptureVoiceVolume(voiceVolume);
  }, [voiceVolume]);

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

  useEffect(() => {
    if (!voiceEnabled || !cameraOpen || reviewingCapture || !guidance) return;
    const hint = resolveCaptureVoiceHint(guidance);
    if (!hint) return;
    captureVoiceGuide.speak(hint.text, hint.priority, hint.key);
  }, [voiceEnabled, cameraOpen, reviewingCapture, guidance]);

  const handleSkipPhotoGuideChange = useCallback((checked: boolean) => {
    setSkipPhotoGuide(checked);
    if (checked) setScanPhotoGuideDismissed();
    else clearScanPhotoGuideDismissed();
  }, []);

  useEffect(() => {
    if (step !== "naming" || isOnboardingScan) return;
    let cancelled = false;
    void (async () => {
      const scanNumber = await fetchNextScanNumber(async () => {
        const res = await fetch("/api/patient/home", {
          credentials: "include",
        });
        if (!res.ok) throw new Error("home");
        return (await res.json()) as { skinScanHistory?: unknown[] };
      });
      if (!cancelled) {
        setScanName(buildAutoScanName({ scanNumber }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, isOnboardingScan]);

  const clearPendingCapture = useCallback((item: PendingCapture | null) => {
    if (item?.preview) URL.revokeObjectURL(item.preview);
  }, []);

  const primaryPreview =
    slotCaptures[0]?.preview ?? slotCaptures.find((c) => c)?.preview ?? null;

  const captureCount = filledSlotCount(slotCaptures);
  const slotsComplete = allSlotsFilled(slotCaptures);

  const assignFileToSlot = useCallback((index: number, file: File) => {
    if (!file.type.startsWith("image/")) {
      setUploadError("Please choose an image file.");
      return;
    }
    setUploadError(null);
    setSlotCaptures((prev) => {
      const next = [...prev];
      if (next[index]) URL.revokeObjectURL(next[index]!.preview);
      next[index] = {
        file,
        preview: URL.createObjectURL(file),
        label: FACE_SCAN_CAPTURE_STEPS[index].id,
      };
      if (allSlotsFilled(next)) {
        queueMicrotask(() => setStep("confirm"));
      }
      return next;
    });
    setScanResults(null);
  }, []);

  const clearSlot = useCallback(
    (index: number) => {
      setSlotCaptures((prev) => {
        const next = [...prev];
        const removed = next[index];
        if (removed) URL.revokeObjectURL(removed.preview);
        next[index] = null;
        return next;
      });
      if (step === "confirm") setStep("upload");
    },
    [step],
  );

  const openUploadForSlot = useCallback((index: number) => {
    setUploadTargetIndex(index);
    slotUploadInputRef.current?.click();
  }, []);

  const applyFilesToEmptySlots = useCallback(
    (files: FileList | File[] | null) => {
      if (!files?.length) return;
      const images = Array.from(files).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (images.length === 0) {
        setUploadError("Please choose image files only.");
        return;
      }
      setUploadError(null);
      if (variant === "dashboard") {
        setShowDeviceUpload(true);
        setStep("phone-qr");
      }
      setSlotCaptures((prev) => {
        const next = [...prev];
        let imageIdx = 0;
        let added = 0;
        for (
          let slotIdx = 0;
          slotIdx < N_CAPTURES && imageIdx < images.length;
          slotIdx++
        ) {
          if (next[slotIdx]) continue;
          const file = images[imageIdx++]!;
          next[slotIdx] = {
            file,
            preview: URL.createObjectURL(file),
            label: FACE_SCAN_CAPTURE_STEPS[slotIdx].id,
          };
          added += 1;
        }
        const leftover = images.length - added;
        if (leftover > 0) {
          setUploadError(
            `Added ${added} photo${added === 1 ? "" : "s"} to empty slots. ${leftover} extra file${leftover === 1 ? " was" : "s were"} skipped â€” tap a slot to replace one.`,
          );
        }
        if (allSlotsFilled(next)) {
          queueMicrotask(() => setStep("confirm"));
        }
        return next;
      });
      setScanResults(null);
    },
    [variant],
  );

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

  const attachVideoRef = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (!el || !streamRef.current) return;
    el.srcObject = streamRef.current;
    void el.play().catch(() => {});
  }, []);

  useEffect(() => {
    if (!cameraOpen || !streamRef.current) return;
    const el = videoRef.current;
    if (!el) return;
    el.srcObject = streamRef.current;
    void el.play().catch(() => {});
  }, [cameraOpen, facingMode, cameraStepIndex]);

  const startCamera = useCallback(async (facing: "user" | "environment") => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setCameraError(
        "Camera is not available in this browser. Try Chrome, Safari, or Edge, or upload photos instead.",
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
        "Could not open the camera. Allow permission in your browser, use HTTPS (or localhost), or upload files instead.",
      );
    }
  }, []);

  const openCameraForMultiCapture = useCallback(() => {
    setUploadError(null);
    setCaptureZoom(CAPTURE_ZOOM_DEFAULT);
    resetAdjustments();
    setPendingCapture((prev) => {
      clearPendingCapture(prev);
      return null;
    });
    const nextIdx = firstEmptySlotIndex(slotCaptures);
    if (nextIdx >= N_CAPTURES) {
      setUploadError(
        "All three angles are filled. Remove one below to retake with the camera, or continue to preview.",
      );
      return;
    }
    setCameraStepIndex(nextIdx);
    void startCamera("user");
  }, [slotCaptures, startCamera, clearPendingCapture, resetAdjustments]);

  const autoStartedHandoffTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!tokenParam || autoStartedHandoffTokenRef.current === tokenParam)
      return;
    autoStartedHandoffTokenRef.current = tokenParam;
    setPhotoGuideOpen(false);
    setOnboardingGuideComplete(true);
    openCameraForMultiCapture();
  }, [tokenParam, openCameraForMultiCapture]);

  const requestOpenCamera = useCallback(() => {
    if (skipPhotoGuide) {
      openCameraForMultiCapture();
      return;
    }
    setPhotoGuideIntent("camera");
    setPhotoGuideOpen(true);
  }, [skipPhotoGuide, openCameraForMultiCapture]);

  /** `?autoCamera=1` (e.g. from the capture-guide carousel's shutter button)
   * jumps straight into the normal camera-open flow — same guard/photo-guide
   * behavior as tapping "Use Phone Camera" manually. */
  const autoStartedCameraRef = useRef(false);
  useEffect(() => {
    if (!autoCameraParam || autoStartedCameraRef.current) return;
    autoStartedCameraRef.current = true;
    requestOpenCamera();
  }, [autoCameraParam, requestOpenCamera]);

  const openPhotoGuideReview = useCallback(() => {
    setPhotoGuideIntent("review");
    setPhotoGuideOpen(true);
  }, []);

  const closePhotoGuide = useCallback(() => {
    setPhotoGuideOpen(false);
    if (isOnboardingScan) setOnboardingGuideComplete(true);
  }, [isOnboardingScan]);

  const handlePhotoGuideBack = useCallback(() => {
    if (isOnboardingScan && !onboardingGuideComplete) {
      router.push("/onboarding/kai-intro");
      return;
    }
    closePhotoGuide();
  }, [isOnboardingScan, onboardingGuideComplete, router, closePhotoGuide]);

  const completePhotoGuide = useCallback(() => {
    const intent = photoGuideIntent;
    setPhotoGuideOpen(false);
    if (isOnboardingScan) setOnboardingGuideComplete(true);
    if (intent === "camera") {
      openCameraForMultiCapture();
    }
  }, [openCameraForMultiCapture, photoGuideIntent, isOnboardingScan]);

  const setCaptureZoomManual = useCallback((value: number) => {
    setCaptureZoom(value);
  }, []);

  const captureFromCamera = useCallback(() => {
    const video = videoRef.current;
    if (!video || !streamRef.current || pendingCapture) return;
    if (!guidance?.readyToCapture) return;
    if (cameraStepIndex >= N_CAPTURES) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;
    const step = FACE_SCAN_CAPTURE_STEPS[cameraStepIndex];
    const cropToGuide = shouldCropToFaceGuide(step.id);
    const viewfinderW = video.clientWidth;
    const viewfinderH = video.clientHeight;
    if (viewfinderW > 0 && viewfinderH > 0) {
      handoffViewfinderRef.current = { w: viewfinderW, h: viewfinderH };
    }
    const maxEdge = 1280;
    let tw: number;
    let th: number;
    if (cropToGuide && viewfinderW && viewfinderH) {
      ({ w: tw, h: th } = viewfinderCaptureDimensions(
        viewfinderW,
        viewfinderH,
        maxEdge,
      ));
    } else if (w > maxEdge || h > maxEdge) {
      if (w >= h) {
        th = Math.round((h * maxEdge) / w);
        tw = maxEdge;
      } else {
        tw = Math.round((w * maxEdge) / h);
        th = maxEdge;
      }
    } else {
      tw = w;
      th = h;
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
    if (cropToGuide) {
      ({ sx, sy, sw, sh } = getVisibleVideoRect(
        w,
        h,
        viewfinderW,
        viewfinderH,
        zoom,
      ));
    } else if (zoom > 1) {
      sw = w / zoom;
      sh = h / zoom;
      sx = (w - sw) / 2;
      sy = (h - sh) / 2;
    }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, tw, th);
    ctx.restore();

    // Bake the same brightness/contrast the user sees in the preview. Done with a
    // pixel pass (not ctx.filter) because Safari ignores ctx.filter on 2D canvas,
    // which left the saved photo unadjusted even though the preview looked right.
    if (brightness !== ADJUST_DEFAULT || contrast !== ADJUST_DEFAULT) {
      try {
        const img = ctx.getImageData(0, 0, tw, th);
        const px = img.data;
        const b = brightness / 100;
        const c = contrast / 100;
        for (let i = 0; i < px.length; i += 4) {
          for (let ch = 0; ch < 3; ch++) {
            // CSS filter order: brightness first, then contrast.
            const bright = px[i + ch] * b;
            const adjusted = (bright - 128) * c + 128;
            px[i + ch] = adjusted < 0 ? 0 : adjusted > 255 ? 255 : adjusted;
          }
        }
        ctx.putImageData(img, 0, 0);
      } catch {
        // getImageData can throw on a tainted canvas; keep the unadjusted capture.
      }
    }

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (cameraStepIndex >= N_CAPTURES) return;
        const captured = new File(
          [blob],
          `face-scan-${step.id}-${Date.now()}.jpg`,
          { type: "image/jpeg" },
        );
        const preview = URL.createObjectURL(blob);
        setPendingCapture((prev) => {
          clearPendingCapture(prev);
          return { file: captured, preview, label: step.id };
        });
      },
      "image/jpeg",
      0.82,
    );
  }, [
    captureZoom,
    brightness,
    contrast,
    facingMode,
    pendingCapture,
    clearPendingCapture,
    cameraStepIndex,
    guidance?.readyToCapture,
  ]);

  const confirmPendingCapture = useCallback(() => {
    if (!pendingCapture) return;
    const item = pendingCapture;
    setPendingCapture(null);
    setSlotCaptures((prev) => {
      if (cameraStepIndex >= N_CAPTURES) return prev;
      const next = [...prev];
      if (next[cameraStepIndex])
        URL.revokeObjectURL(next[cameraStepIndex]!.preview);
      next[cameraStepIndex] = item;
      if (allSlotsFilled(next)) {
        queueMicrotask(() => {
          stopCamera();
          setStep("confirm");
        });
      } else {
        setCameraStepIndex(firstEmptySlotIndex(next));
      }
      return next;
    });
  }, [pendingCapture, stopCamera, cameraStepIndex]);

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
    stopCamera();
  }, [stopCamera, clearPendingCapture, resetAdjustments]);

  const resetScan = useCallback(() => {
    stopCamera();
    setPendingCapture((prev) => {
      clearPendingCapture(prev);
      return null;
    });
    setSlotCaptures((prev) => {
      revokeSlotCaptures(prev);
      return emptySlotCaptures();
    });
    setCameraStepIndex(0);
    setStep("upload");
    setScanName(isOnboardingScan ? BASELINE_ONBOARDING_SCAN_NAME : "");
    setScanResults(null);
    setUploadError(null);
    setScanError(null);
    setHandoffSending(false);
    setHandoffError(null);
    setIdentityChecks(null);
    setPhotoGuideOpen(false);
    setPhotoGuideIntent("camera");
    setSkipPhotoGuide(isScanPhotoGuideDismissed());
  }, [stopCamera, isOnboardingScan, clearPendingCapture]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      applyFilesToEmptySlots(e.dataTransfer.files);
    },
    [applyFilesToEmptySlots],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    applyFilesToEmptySlots(e.target.files);
    e.target.value = "";
  };

  const handleSlotUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || uploadTargetIndex == null) return;
    assignFileToSlot(uploadTargetIndex, file);
    setUploadTargetIndex(null);
  };

  const sendPhotosToDesktop = useCallback(async () => {
    if (!slotsComplete || !sessionIdParam || !tokenParam) return;
    setHandoffSending(true);
    setHandoffError(null);
    try {
      const formData = new FormData();
      formData.append("sessionId", sessionIdParam);
      const vf = handoffViewfinderRef.current;
      if (vf) {
        appendCaptureCropContext(formData, {
          source: "mobile",
          viewfinderW: vf.w,
          viewfinderH: vf.h,
        });
      }
      slotCaptures.forEach((c) => {
        if (c) formData.append("images", c.file);
      });

      const res = await fetch("/api/mobile-capture/photos", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenParam}`,
        },
        body: formData,
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        success?: boolean;
      };
      if (!res.ok || !json.success) {
        throw new Error(
          json.error || `Could not send photos to desktop (${res.status}).`,
        );
      }
      setStep("handoff-sent");
    } catch (err: unknown) {
      setHandoffError(
        err instanceof Error
          ? err.message
          : "Could not send photos. Check your connection and try again.",
      );
    } finally {
      setHandoffSending(false);
    }
  }, [slotCaptures, slotsComplete, sessionIdParam, tokenParam]);

  const handleRemotePhotosReady = useCallback(
    async (
      captureImages: MobileCaptureImageRef[],
      cropContext?: CaptureCropContext | null,
    ) => {
      try {
        setUploadError(null);
        setQrCropContext(cropContext ?? null);
        const loaded = await loadRemoteCaptureSlots(captureImages);
        setSlotCaptures((prev) => {
          revokeSlotCaptures(prev);
          return loaded;
        });
        setCameraStepIndex(0);
        setStep("confirm");
      } catch (err: unknown) {
        setUploadError(
          err instanceof Error
            ? err.message
            : "Could not load photos from your phone.",
        );
        setStep("phone-qr");
      }
    },
    [],
  );

  const runScan = useCallback(async () => {
    if (!slotsComplete) return;
    const finalScanName = resolveScanName(scanName);
    setStep("scanning");
    setScanError(null);
    setIdentityChecks(null);
    try {
      const formData = new FormData();
      formData.append("scanName", finalScanName);
      if (qrSessionId && !sessionIdParam) {
        formData.append("mobileSessionId", qrSessionId);
      }
      if (sessionIdParam) {
        formData.append("sessionId", sessionIdParam);
      }
      const vf = handoffViewfinderRef.current;
      if (tokenParam && vf) {
        appendCaptureCropContext(formData, {
          source: "mobile",
          viewfinderW: vf.w,
          viewfinderH: vf.h,
        });
      } else if (qrCropContext) {
        appendCaptureCropContext(formData, qrCropContext);
      } else if (!tokenParam) {
        appendCaptureCropContext(formData, { source: "web" });
      }
      slotCaptures.forEach((c) => {
        if (c) formData.append("images", c.file);
      });

      if (tokenParam) {
        const res = await fetch("/api/mobile-capture/submit", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenParam}`,
          },
          body: formData,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            json.message || json.error || `Submission failed (${res.status})`,
          );
        }
        const scanId = Number(json?.data?.id);
        setCompletedHandoffScanId(Number.isFinite(scanId) ? scanId : null);
        setStep("results");
        return;
      }

      const outcome = await submitFaceScan(formData);

      if (outcome.mode === "queued") {
        addPendingScanJob(outcome.jobId, finalScanName);
        setStep("queued");
        return;
      }

      if (outcome.mode === "error") {
        setScanError(outcome.message);
        setIdentityChecks(outcome.identityChecks ?? null);
        setStep("naming");
        return;
      }

      const scanId = outcome.scanId;
      if (isOnboardingScan) {
        router.push(
          `/onboarding/baseline-report?scanId=${encodeURIComponent(String(scanId))}`,
        );
        return;
      }
      router.push(`/dashboard/scans/${scanId}/report`);
    } catch (err: unknown) {
      setScanError(
        err instanceof Error
          ? err.message
          : "Network error. Check your connection and try again.",
      );
      setStep("naming");
    }
  }, [
    slotCaptures,
    slotsComplete,
    scanName,
    router,
    isOnboardingScan,
    tokenParam,
    sessionIdParam,
    qrSessionId,
    qrCropContext,
  ]);

  const showPhotoGuide = step === "upload" && !cameraOpen && photoGuideOpen;
  const onboardingPastGuide = !isOnboardingScan || onboardingGuideComplete;
  /** Keep chrome visible under the phone-QR modal so file inputs stay mounted. */
  const showUploadChrome = !showPhotoGuide && onboardingPastGuide;
  const navy = SKINFIT_THEME.navy;
  const onboardingSurface =
    "border-[#1E1B31]/10 bg-white/25 shadow-none backdrop-blur-sm";
  const onboardingSurfaceHover = "hover:border-[#1E1B31]/18 hover:bg-white/35";
  const isDiagnoseHero =
    variant === "dashboard" &&
    ((step === "upload" && !cameraOpen && !showPhotoGuide) ||
      step === "phone-qr");

  useEffect(() => {
    onLayoutExpanded?.(!isDiagnoseHero);
  }, [isDiagnoseHero, onLayoutExpanded]);

  const captureSlotsPanel = (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#1E1B31]/60">
          Capture checklist
        </p>
        <p className="text-[11px] font-semibold text-[#4CAF50]">
          {captureCount}/{N_CAPTURES} added
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-5">
        {FACE_SCAN_CAPTURE_STEPS.map((captureStep, index) => {
          const filled = slotCaptures[index];
          return (
            <div
              key={captureStep.id}
              className={`relative rounded-2xl border px-2 py-2 text-center transition-colors ${
                filled
                  ? "border-[#4CAF50]/40 bg-[#E8F5E9]/80"
                  : "cursor-pointer border-[#1E1B31]/15 bg-white hover:border-[#1E1B31]/30 hover:bg-[#FAF8F5]"
              }`}
            >
              {filled ? (
                <>
                  <button
                    type="button"
                    onClick={() => clearSlot(index)}
                    className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#64748B] shadow-sm transition hover:bg-rose-50 hover:text-rose-600"
                    aria-label={`Remove ${captureStep.title}`}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={filled.preview}
                    alt={captureStep.title}
                    className="mx-auto h-12 w-12 rounded-xl object-cover ring-1 ring-[#4CAF50]/30"
                  />
                  <p className="mt-1 line-clamp-2 text-[10px] font-bold leading-tight text-[#1E5E3A]">
                    {captureStep.title}
                  </p>
                  <button
                    type="button"
                    onClick={() => openUploadForSlot(index)}
                    className="mt-1 text-[10px] font-semibold text-[#1E1B31] underline-offset-2 hover:underline"
                  >
                    Replace
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => openUploadForSlot(index)}
                  className="flex w-full flex-col items-center py-1"
                >
                  <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#94A3B8]">
                    {index + 1}
                  </p>
                  <p className="mt-0.5 text-xs font-bold text-[#1E1B31]">
                    {captureStep.title}
                  </p>
                  <p className="mt-1 text-[10px] font-medium text-[#94A3B8]">
                    Tap to upload
                  </p>
                </button>
              )}
            </div>
          );
        })}
      </div>
      {slotsComplete ? (
        <button
          type="button"
          onClick={() => {
            setShowDeviceUpload(false);
            setStep("confirm");
          }}
          className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-[#1E1B31] py-3 text-sm font-bold text-white transition hover:bg-[#242A5F]"
        >
          <Check className="h-4 w-4" aria-hidden />
          Continue to preview
        </button>
      ) : null}
    </div>
  );

  if (isMobileHandoff && step === "handoff-sent") {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-3xl border border-[#1E1B31]/10 bg-white p-8 shadow-xl backdrop-blur-md"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20">
            <Check className="h-8 w-8" />
          </div>
          <h2 className="mt-6 text-2xl font-extrabold text-[#1E1B31]">
            Photos sent to your computer
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            Your three photos are on the desktop scan page. Name your scan and
            start analysis there when you are ready.
          </p>
          <p className="mt-4 text-xs text-slate-400">
            You can close this tab.
          </p>
        </motion.div>
      </div>
    );
  }

  if (isMobileHandoff && step === "results") {
    const mobileReportHref =
      completedHandoffScanId && sessionIdParam && tokenParam
        ? `/api/mobile-capture/claim?s=${encodeURIComponent(sessionIdParam)}&t=${encodeURIComponent(tokenParam)}&next=${encodeURIComponent(isOnboardingScan ? `/onboarding/baseline-report?scanId=${completedHandoffScanId}` : `/dashboard/scans/${completedHandoffScanId}/report`)}`
        : null;

    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-3xl border border-[#1E1B31]/10 bg-white p-8 shadow-xl backdrop-blur-md"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20 animate-bounce">
            <Check className="h-8 w-8" />
          </div>
          <h2 className="mt-6 text-2xl font-extrabold text-[#1E1B31]">
            Scan complete
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            Your analysis is ready. View the report on this phone or on your
            computer.
          </p>
          {mobileReportHref ? (
            <a
              href={mobileReportHref}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1E1B31] px-4 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#5B66A1]"
            >
              View report
              <ArrowRight className="h-4 w-4" />
            </a>
          ) : null}
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className={`${
        cameraOpen
          ? "mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col"
          : step === "scanning"
            ? "mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-4 py-8 md:px-8"
            : isDiagnoseHero
              ? "flex h-full min-h-0 w-full flex-col"
              : variant === "dashboard"
                ? "mx-auto max-w-4xl space-y-6 px-4 pb-16 pt-6 md:px-8"
                : "mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center space-y-5"
      }`}
    >
      {/* Always-mounted pickers so modal upload can trigger them */}
      <input
        id="scan-file-input"
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={handleInputChange}
      />
      <input
        ref={slotUploadInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleSlotUploadChange}
      />

      {showPhotoGuide ? (
        <FaceScanPhotoGuide
          mode={photoGuideIntent}
          dontRemind={skipPhotoGuide}
          onDontRemindChange={handleSkipPhotoGuideChange}
          onContinue={completePhotoGuide}
          onBack={handlePhotoGuideBack}
          showDismissOption={!isOnboardingScan}
        />
      ) : null}

      {step === "phone-qr" && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Scan with your phone"
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E5E7EB] bg-white/95 px-4 py-3 backdrop-blur-sm sm:px-5">
              <p className="text-sm font-extrabold text-[#18181b]">
                Scan with your phone
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowDeviceUpload(false);
                  setStep("upload");
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E5E7EB] text-[#6B7280] transition hover:bg-[#FAF8F5]"
                aria-label="Close"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="space-y-5 px-4 py-5 sm:px-5">
              {!isOnboardingScan ? (
                <div className="text-center sm:text-left">
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#1E1B31]/60">
                    Skin analysis
                  </p>
                  <h2
                    className="mt-1 text-xl font-extrabold tracking-tight sm:text-2xl"
                    style={{ color: navy }}
                  >
                    Continue on your phone
                  </h2>
                  <p className="mt-2 text-sm text-[#64748B]">
                    Point your phone camera at the QR code below to capture all
                    three angles.
                  </p>
                </div>
              ) : null}

              <MobileCaptureQRPanel
                onBack={() => {
                  setShowDeviceUpload(false);
                  setStep("upload");
                }}
                onSessionReady={setQrSessionId}
                onPhotosReady={(captureImages, cropContext) => {
                  void handleRemotePhotosReady(captureImages, cropContext);
                }}
                onScanComplete={(scanId) => {
                  if (isOnboardingScan) {
                    router.push(
                      `/onboarding/baseline-report?scanId=${encodeURIComponent(String(scanId))}`,
                    );
                  } else {
                    router.push(`/dashboard/scans/${scanId}/report`);
                  }
                }}
                isOnboardingScan={isOnboardingScan}
              />

              <div className="relative flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-[#E5E7EB]" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                  or
                </span>
                <div className="h-px flex-1 bg-[#E5E7EB]" />
              </div>

              {!showDeviceUpload ? (
                <button
                  type="button"
                  onClick={() => setShowDeviceUpload(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#1E1B31]/20 bg-[#FAF8F5] px-4 py-3.5 text-sm font-bold text-[#1E1B31] transition hover:border-[#1E1B31]/35 hover:bg-[#F0EAE2]"
                >
                  <ImagePlus className="h-4 w-4" aria-hidden />
                  Upload photos from this device
                </button>
              ) : (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`space-y-4 rounded-2xl border-2 border-dashed p-4 transition-colors ${
                    isDragging
                      ? "border-[#1E1B31]/40 bg-[#FAF8F5]"
                      : "border-[#1E1B31]/15 bg-[#F8FAF8]"
                  }`}
                >
                  <div className="text-center">
                    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F0EAE2]">
                      <ImagePlus className="h-5 w-5 text-[#1E1B31]" />
                    </div>
                    <p className="mt-3 text-sm font-extrabold text-[#18181b]">
                      Upload photos from this device
                    </p>
                    <p className="mx-auto mt-1 max-w-xs text-xs text-[#64748B]">
                      Tap each slot to add one photo, or choose multiple files at
                      once.
                    </p>
                    <label
                      htmlFor="scan-file-input"
                      className="mt-4 inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[#1E1B31]/20 bg-white px-5 py-2.5 text-xs font-extrabold text-[#1E1B31] transition hover:bg-[#FAF8F5]"
                    >
                      <ImagePlus className="h-3.5 w-3.5" />
                      Choose files
                    </label>
                  </div>
                  {captureSlotsPanel}
                  {uploadError ? (
                    <p
                      className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm text-amber-900"
                      role="alert"
                    >
                      {uploadError}
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {showUploadChrome &&
      step !== "scanning" &&
      step !== "phone-qr" &&
      !(step === "upload" && cameraOpen) &&
      !isOnboardingScan &&
      !isDiagnoseHero ? (
        <motion.header
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-4xl"
        >
          <div className="flex items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0 text-left">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#1E1B31]/60">
                Skin analysis
              </p>
              <h1
                className="mt-1 text-3xl font-extrabold tracking-tight"
                style={{ color: navy }}
              >
                AI face scan
              </h1>
            </div>
            {step === "upload" && !cameraOpen ? (
              <Link
                href="/dashboard/history"
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[#1E1B31]/15 bg-white/60 px-3 py-2 text-sm font-semibold text-[#1E1B31] shadow-sm transition hover:border-[#1E1B31]/30 hover:bg-white/80 sm:px-4 sm:py-2.5"
              >
                <History className="h-4 w-4" aria-hidden />
                See scan history
              </Link>
            ) : null}
          </div>
        </motion.header>
      ) : null}

      {/* Step: Upload â€” live camera (multi-capture) */}
      {!showPhotoGuide && step === "upload" && cameraOpen && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex min-h-0 w-full flex-1 flex-col"
        >
          <WebCaptureStepShell
            step={currentCameraStep}
            stepIndex={cameraStepIndex}
            totalSteps={N_CAPTURES}
            reviewingCapture={reviewingCapture}
            guidance={guidance}
            guidanceReady={guidance?.readyToCapture ?? false}
            voiceEnabled={voiceEnabled}
            voiceVolume={voiceVolume}
            onVoiceVolumeChange={setVoiceVolume}
            showDebug={showDebug}
            captureDebugUi={captureDebugUi}
            onToggleVoice={() => setVoiceEnabled((v) => !v)}
            onToggleDebug={() => setShowDebug((v) => !v)}
            onBack={cancelCamera}
            viewfinder={
              <>
                <video
                  ref={attachVideoRef}
                  className={`block h-full w-full object-cover ${reviewingCapture ? "invisible" : ""}`}
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
                {!reviewingCapture ? (
                  <CaptureFaceGuideOverlayWeb stepId={currentCameraStep.id} />
                ) : null}
              </>
            }
            controls={
              <WebCaptureShutterControls
                reviewingCapture={reviewingCapture}
                shutterDisabled={slotsComplete || !guidance?.readyToCapture}
                onShutter={captureFromCamera}
                onRetake={retakePendingCapture}
                onConfirm={confirmPendingCapture}
                isLastStep={captureCount + 1 >= N_CAPTURES}
              />
            }
            sidebar={
              <div
                className={`flex min-h-0 flex-col gap-2 ${
                  reviewingCapture ? "pointer-events-none opacity-50" : ""
                }`}
              >
                <ScanCaptureExtraTipsPanel compact dense />
                <div className="shrink-0 rounded-lg border border-[#1E1B31]/10 bg-white/70 p-2 sm:rounded-xl sm:p-2.5">
                  <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#1E1B31]/60 sm:text-[11px]">
                    Zoom
                  </p>
                  <div className="mt-1.5">
                    <AdjustSlider
                      compact
                      icon={<ZoomIn className="h-3 w-3 text-[#1E1B31]/70" />}
                      label="Zoom"
                      value={captureZoom}
                      min={CAPTURE_ZOOM_MIN}
                      max={CAPTURE_ZOOM_MAX}
                      step={CAPTURE_ZOOM_STEP}
                      suffix="Ã—"
                      format={(v) => v.toFixed(1)}
                      onChange={setCaptureZoomManual}
                    />
                    {captureZoom !== CAPTURE_ZOOM_DEFAULT ? (
                      <button
                        type="button"
                        onClick={() => setCaptureZoomManual(CAPTURE_ZOOM_DEFAULT)}
                        className="mt-1.5 text-xs font-medium text-[#1E1B31]/70 underline-offset-2 hover:underline"
                      >
                        Reset zoom
                      </button>
                    ) : null}
                  </div>
                </div>
                {captureDebugUi && !reviewingCapture && showDebug ? (
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
              </div>
            }
          />
        </motion.div>
      )}

      {showUploadChrome && step === "upload" && !cameraOpen && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className={`w-full ${isDiagnoseHero ? "flex h-full flex-col" : ""}`}
        >
          <div
            className={
              isDiagnoseHero
                ? "relative -mx-1 flex h-full min-h-0 flex-col overflow-hidden sm:-mx-2"
                : "space-y-5"
            }
          >
            {isDiagnoseHero ? (
              <div className="pointer-events-none absolute inset-0" aria-hidden>
                {/* Page-level DiagnosePageAtmosphere supplies the lavender wash;
                    keep only soft leaves here so the CTA sits in the atmosphere. */}
                <Leaf
                  className="leaf-drift absolute bottom-8 left-1 h-12 w-12 text-[#8FAE86]/40"
                  style={{ ["--leaf-rot" as string]: "-18deg" }}
                  strokeWidth={1.25}
                />
                <Leaf
                  className="leaf-drift absolute right-2 top-[22%] h-7 w-7 text-[#8FAE86]/30"
                  style={{
                    ["--leaf-rot" as string]: "12deg",
                    animationDelay: "1.4s",
                  }}
                  strokeWidth={1.25}
                />
              </div>
            ) : null}
            <div
              className={
                isDiagnoseHero
                  ? "relative z-10 flex h-full min-h-0 flex-col space-y-4 px-1 pb-2 pt-2 sm:px-2"
                  : "contents"
              }
            >
            <div
              className={`grid gap-4 ${
                isOnboardingScan
                  ? "md:grid-cols-[1.05fr_0.95fr]"
                  : isDiagnoseHero
                    ? "flex-1"
                    : ""
              }`}
            >
              {!isMobileDevice && isDiagnoseHero ? (
                <div className="flex h-full min-h-0 flex-col justify-end pt-8 sm:pt-10">
                  <span className="relative inline-flex w-fit items-center rounded-full bg-white/75 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#1E1B31] shadow-sm">
                    Recommended
                  </span>
                  <div className="relative mt-5 flex items-center gap-4">
                    <div className="relative flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-full border border-dashed border-[#1E1B31]/30 bg-white/40 shadow-[0_0_0_8px_rgba(255,255,255,0.45)]">
                      <div className="camera-icon-breathe flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-[0_8px_24px_-12px_rgba(30, 27, 49,0.45)]">
                        <Smartphone className="h-6 w-6 text-[#1E1B31]" />
                      </div>
                      <Sparkles
                        className="absolute -right-0.5 -top-0.5 h-4 w-4 text-[#1E1B31]/45"
                        strokeWidth={2}
                        aria-hidden
                      />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-xl font-extrabold tracking-tight leading-tight text-[#1E1B31]">
                        Scan with phone camera
                      </h2>
                      <p className="mt-1.5 text-sm leading-relaxed text-[#6B7280]">
                        On laptop, use your phone for the best face-scan quality.
                        Scan a QR code to continue on mobile.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeviceUpload(false);
                      setStep("phone-qr");
                    }}
                    className="cta-pop relative mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#1E1B31] px-5 py-3.5 text-sm font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(30, 27, 49,0.6)] transition-colors hover:bg-[#354A7A]"
                  >
                    Start on phone
                    <Smartphone className="h-4 w-4" />
                  </button>
                </div>
              ) : !isMobileDevice ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowDeviceUpload(false);
                    setStep("phone-qr");
                  }}
                  className="group relative overflow-hidden rounded-[24px] bg-[#1E1B31] p-6 text-left text-white shadow-[0_18px_40px_-22px_rgba(30, 27, 49,0.8)] transition-all duration-300 hover:-translate-y-1 hover:bg-[#354A7A] focus:outline-none focus:ring-2 focus:ring-[#1E1B31]/30"
                >
                  <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 transition-transform duration-500 group-hover:scale-110" />
                  <div className="relative flex h-full flex-col justify-between">
                    <div>
                      <span className="inline-flex items-center rounded-full bg-white/14 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/80">
                        Recommended
                      </span>
                      <div className="mt-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 shadow-inner">
                        <Smartphone className="h-7 w-7" />
                      </div>
                      <h2 className="mt-5 text-xl font-extrabold tracking-tight leading-tight">
                        Scan with phone camera
                      </h2>
                      <p className="mt-2 text-xs leading-relaxed text-white/75">
                        On desktop, capture with your phone for the best
                        face-scan quality. Scan the QR code to start on your
                        phone — or upload photos from this device in the next
                        step.
                      </p>
                    </div>
                    <span className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-xs font-extrabold text-[#1E1B31] transition-colors group-hover:bg-[#F8FAFC]">
                      Use Phone Camera
                      <Smartphone className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </button>
              ) : isDiagnoseHero ? (
                <div className="flex h-full min-h-0 flex-col justify-end pt-8 sm:pt-10">
                  <span className="relative inline-flex w-fit items-center rounded-full bg-white/75 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#1E1B31] shadow-sm">
                    Recommended
                  </span>
                  <div className="relative mt-5 flex items-center gap-4">
                    <div className="relative flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-full border border-dashed border-[#1E1B31]/30 bg-white/40 shadow-[0_0_0_8px_rgba(255,255,255,0.45)]">
                      <div className="camera-icon-breathe flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-[0_8px_24px_-12px_rgba(30, 27, 49,0.45)]">
                        <Camera className="h-6 w-6 text-[#1E1B31]" />
                      </div>
                      <Sparkles
                        className="absolute -right-0.5 -top-0.5 h-4 w-4 text-[#1E1B31]/45"
                        strokeWidth={2}
                        aria-hidden
                      />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-xl font-extrabold tracking-tight leading-tight text-[#1E1B31]">
                        Use device camera
                      </h2>
                      <p className="mt-1.5 text-sm leading-relaxed text-[#6B7280]">
                        Capture using your device camera. Keep angles aligned
                        with the guide.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={requestOpenCamera}
                    className="cta-pop relative mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#1E1B31] px-5 py-3.5 text-sm font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(30, 27, 49,0.6)] transition-colors hover:bg-[#354A7A]"
                  >
                    Start Camera
                    <Camera className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={requestOpenCamera}
                  className="group relative overflow-hidden rounded-[24px] bg-[#1E1B31] p-6 text-left text-white shadow-[0_18px_40px_-22px_rgba(30, 27, 49,0.8)] transition-all duration-300 hover:-translate-y-1 hover:bg-[#354A7A] focus:outline-none focus:ring-2 focus:ring-[#1E1B31]/30"
                >
                  <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10" />
                  <div className="relative flex h-full flex-col justify-between">
                    <div>
                      <span className="inline-flex items-center rounded-full bg-white/14 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/80">
                        Recommended
                      </span>
                      <div className="mt-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 shadow-inner">
                        <Camera className="h-7 w-7" />
                      </div>
                      <h2 className="mt-5 text-xl font-extrabold tracking-tight leading-tight">
                        Use device camera
                      </h2>
                      <p className="mt-2 text-xs leading-relaxed text-white/75">
                        Capture using your device camera. Keep angles aligned
                        with the guide.
                      </p>
                    </div>
                    <span className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-xs font-extrabold text-[#1E1B31] transition-colors group-hover:bg-[#F8FAFC]">
                      Start Camera
                      <Camera className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </button>
              )}

              {isOnboardingScan ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`flex flex-col justify-between rounded-[24px] border-2 border-dashed p-5 text-center transition-colors min-h-[270px] ${
                    isDragging
                      ? "border-[#1E1B31]/40 bg-white/40"
                      : `border-[#1E1B31]/12 ${onboardingSurface}`
                  }`}
                >
                  <div>
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F0EAE2]">
                      <ImagePlus className="h-6 w-6 text-[#1E1B31]" />
                    </div>
                    <h2
                      className="mt-4 text-base font-extrabold"
                      style={{ color: navy }}
                    >
                      Upload photos
                    </h2>
                    <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-[#64748B]">
                      Tap each slot below to add one photo at a time, or drop
                      files to fill.
                    </p>
                    <p className="mx-auto mt-1 text-[10px] font-semibold text-[#4CAF50]">
                      {captureCount}/{N_CAPTURES} added
                    </p>
                  </div>
                  <label
                    htmlFor="scan-file-input"
                    className={`mt-6 inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border px-5 py-3 text-xs font-extrabold text-[#1E1B31] transition border-[#1E1B31]/12 bg-white/35 hover:bg-white/50`}
                  >
                    <ImagePlus className="h-3.5 w-3.5" />
                    Choose files
                  </label>
                </div>
              ) : null}
            </div>

            {isOnboardingScan || !isDiagnoseHero ? (
              <div className="space-y-4 pt-1">
                {captureSlotsPanel}
                <div className="flex flex-row flex-wrap items-stretch gap-3">
                  {!isOnboardingScan ? (
                    <ScanPhotoGuideDismissCheckbox
                      checked={skipPhotoGuide}
                      onChange={handleSkipPhotoGuideChange}
                      className="min-w-[min(100%,240px)] flex-1 bg-white/75 shadow-[0_4px_20px_-14px_rgba(30, 27, 49,0.35)]"
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={openPhotoGuideReview}
                    className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border px-5 py-2.5 text-sm font-bold text-[#1E1B31] transition sm:px-6 ${
                      isOnboardingScan
                        ? `w-full ${onboardingSurface} ${onboardingSurfaceHover}`
                        : "border-[#1E1B31]/25 bg-white/60 shadow-sm hover:border-[#1E1B31]/40 hover:bg-white/80"
                    }`}
                  >
                    <Sun className="h-4 w-4" aria-hidden />
                    View photo tips
                  </button>
                </div>

                {isOnboardingScan ? (
                  <Link
                    href="/onboarding/questionnaire?entry=start"
                    className="inline-flex w-full items-center justify-center rounded-xl border border-[#1E1B31]/15 bg-white/60 px-4 py-2.5 text-sm font-semibold text-[#1E1B31] transition hover:bg-white/90"
                  >
                    Continue to questionnaire
                  </Link>
                ) : null}
              </div>
            ) : (
              <div className="flex shrink-0 items-center gap-2.5">
                <button
                  type="button"
                  onClick={openPhotoGuideReview}
                  className="inline-flex flex-1 items-center gap-2.5 rounded-2xl bg-white px-3 py-3 shadow-[0_6px_18px_-14px_rgba(30, 27, 49,0.5)] transition hover:bg-[#F8F7FC]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ECE9F8]">
                    <Sun className="h-4 w-4 text-[#1E1B31]" aria-hidden />
                  </span>
                  <span className="flex-1 text-left text-xs font-bold text-[#18181b]">
                    View photo tips
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" aria-hidden />
                </button>
                <Link
                  href="/dashboard/history"
                  className="inline-flex flex-1 items-center gap-2.5 rounded-2xl bg-white px-3 py-3 shadow-[0_6px_18px_-14px_rgba(30, 27, 49,0.5)] transition hover:bg-[#F8F7FC]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ECE9F8]">
                    <History className="h-4 w-4 text-[#1E1B31]" aria-hidden />
                  </span>
                  <span className="flex-1 text-left text-xs font-bold text-[#18181b]">
                    Scan history
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" aria-hidden />
                </Link>
              </div>
            )}
            </div>
          </div>

          {uploadError && step === "upload" ? (
            <p
              className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900"
              role="alert"
            >
              {uploadError}
            </p>
          ) : null}
          {cameraError ? (
            <p
              className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900"
              role="alert"
            >
              {cameraError}
            </p>
          ) : null}
        </motion.div>
      )}

      {/* Step: Confirm */}
      {step === "confirm" && slotsComplete && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-[22px] border border-white/70 bg-white/35 p-4 backdrop-blur-sm sm:p-6">
            <p className="mb-4 text-center text-xs font-semibold uppercase tracking-wide text-[#1E1B31]/60">
              Preview
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
              {slotCaptures.map((c, i) =>
                c ? (
                  <figure
                    key={`${c.label}-${i}`}
                    className="flex min-w-0 flex-col gap-2"
                  >
                    <div className="relative aspect-[3/4] w-full min-h-[140px] overflow-hidden rounded-2xl bg-zinc-100 ring-1 ring-zinc-200/80 sm:min-h-[160px] lg:min-h-0">
                      <img
                        src={c.preview}
                        alt={FACE_SCAN_CAPTURE_STEPS[i].title}
                        className="h-full w-full object-cover object-center"
                      />
                      <button
                        type="button"
                        onClick={() => clearSlot(i)}
                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-[#64748B] shadow-sm transition hover:bg-rose-50 hover:text-rose-600"
                        aria-label={`Remove ${FACE_SCAN_CAPTURE_STEPS[i].title}`}
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                    <figcaption className="line-clamp-2 text-center text-xs font-medium leading-snug text-zinc-600">
                      {FACE_SCAN_CAPTURE_STEPS[i].title}
                    </figcaption>
                  </figure>
                ) : null,
              )}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                setSlotCaptures((prev) => {
                  revokeSlotCaptures(prev);
                  return emptySlotCaptures();
                });
                setCameraStepIndex(0);
                setStep("upload");
                if (isMobileHandoff) {
                  openCameraForMultiCapture();
                }
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/60 bg-white/50 py-3 text-sm font-medium text-[#1E1B31] backdrop-blur-sm transition-colors hover:bg-white/80"
            >
              <RotateCcw className="h-4 w-4" />
              Retake
            </button>
            {isMobileHandoff ? (
              <>
                <button
                  type="button"
                  disabled={handoffSending}
                  onClick={() => void sendPhotosToDesktop()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E1B31] py-3 text-sm font-medium text-white shadow-md transition-colors hover:bg-[#5B66A1] disabled:opacity-60"
                >
                  <Smartphone className="h-4 w-4" />
                  {handoffSending ? "Sendingâ€¦" : "Send photos to desktop"}
                </button>
                {handoffError ? (
                  <p
                    className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-center text-sm text-rose-900"
                    role="alert"
                  >
                    {handoffError}
                  </p>
                ) : null}
              </>
            ) : (
              <button
                type="button"
                onClick={() => setStep("naming")}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E1B31] py-3 text-sm font-medium text-white shadow-md transition-colors hover:bg-[#5B66A1]"
              >
                <Check className="h-4 w-4" />
                Looks good
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* Step: Naming */}
      {step === "naming" && primaryPreview && slotsComplete && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-[22px] border border-white/70 bg-white/35 p-4 backdrop-blur-sm sm:p-6">
            <p className="mb-4 text-center text-xs font-semibold uppercase tracking-wide text-[#1E1B31]/60">
              Photo in this scan
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
              {slotCaptures.map((c, i) =>
                c ? (
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
                ) : null,
              )}
            </div>
          </div>
          {scanError ? (
            <div className="space-y-3" role="alert">
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-center text-sm text-rose-900">
                {scanError}
              </p>
              {identityChecks?.length ? (
                <FaceIdentityCheckResults checks={identityChecks} />
              ) : null}
            </div>
          ) : null}
          <div className="rounded-[22px] border border-white/70 bg-white/35 p-6 backdrop-blur-sm">
            <label
              htmlFor="scan-name"
              className="mb-3 block text-sm font-medium text-[#1E1B31]"
            >
              Name this scan
            </label>
            <input
              id="scan-name"
              type="text"
              placeholder={SCAN_NAME_INPUT_PLACEHOLDER}
              value={scanName}
              onChange={(e) => setScanName(e.target.value)}
              className="w-full rounded-xl border border-white/60 bg-white/50 px-4 py-3 text-[#1E1B31] placeholder:text-[#1E1B31]/40 backdrop-blur-sm focus:border-[#1E1B31]/40 focus:outline-none focus:ring-2 focus:ring-[#1E1B31]/10"
            />
          </div>
          <button
            type="button"
            onClick={runScan}
            className="w-full rounded-xl bg-[#1E1B31] py-3 text-sm font-medium text-white shadow-md transition-colors hover:bg-[#5B66A1]"
          >
            Start analysis
          </button>
        </motion.div>
      )}

      {/* Step: Scanning */}
      {step === "queued" && <ScanQueuedConfirmation variant={variant} />}

      {step === "scanning" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="mx-auto flex w-full max-w-lg items-center justify-center"
        >
          <div className="relative flex w-full flex-col items-center overflow-hidden rounded-[22px] border border-white/70 bg-white/40 px-8 py-20 text-center backdrop-blur-sm sm:px-12 sm:py-24">
            {/* Breathing orb + ripple rings */}
            <div className="relative mb-10 flex h-48 w-48 items-center justify-center sm:h-56 sm:w-56">
              {/* Ripple ring 1 */}
              <motion.span
                className="absolute inset-0 rounded-full border border-[#1E1B31]/25"
                animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              />
              {/* Ripple ring 2 — offset for continuous feel */}
              <motion.span
                className="absolute inset-0 rounded-full border border-[#1E1B31]/20"
                animate={{ scale: [1, 1.55, 1], opacity: [0.4, 0, 0.4] }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 1,
                }}
              />
              {/* Breathing orb */}
              <motion.div
                className="relative flex h-32 w-32 items-center justify-center rounded-full sm:h-36 sm:w-36"
                animate={{
                  scale: [1, 1.15, 1],
                  boxShadow: [
                    "0 0 40px 0 rgba(30, 27, 49,0.15)",
                    "0 0 80px 8px rgba(30, 27, 49,0.35)",
                    "0 0 40px 0 rgba(30, 27, 49,0.15)",
                  ],
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  background:
                    "radial-gradient(circle at 30% 30%, #4A5F92 0%, #1E1B31 55%, #1E2A4D 100%)",
                }}
              >
                <Sparkles
                  className="h-10 w-10 text-white/85 sm:h-12 sm:w-12"
                  aria-hidden
                />
              </motion.div>
            </div>

            <p className="text-2xl font-bold text-[#1E1B31] sm:text-3xl">
              Take a deep breath.
            </p>
            <p className="mt-3 max-w-xs text-base text-[#6B7280] sm:text-lg">
              kAI is analysing your skin. This takes about 20 seconds.
            </p>
          </div>
        </motion.div>
      )}

      {/* Step: Results â€” full report modal */}
      {step === "results" && scanResults && primaryPreview && (
        <>
          <SkinScanReportModal
            open={reportOpen}
            onClose={() => setReportOpen(false)}
            userName={scanResults.userName?.trim() || "there"}
            imageUrl={primaryPreview}
            faceCaptureGallery={slotCaptures.flatMap((c, i) =>
              c
                ? [
                    {
                      label: FACE_SCAN_CAPTURE_STEPS[i].title,
                      imageUrl: c.preview,
                    },
                  ]
                : [],
            )}
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
              scanResults.scanDate ? new Date(scanResults.scanDate) : new Date()
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
                  className="w-full rounded-xl border border-white/60 bg-white/50 px-6 py-3 text-sm font-semibold text-[#1E1B31] backdrop-blur-sm transition hover:bg-white/80 sm:w-auto"
                >
                  View report again
                </button>
                <button
                  type="button"
                  onClick={resetScan}
                  className="w-full rounded-xl bg-[#1E1B31] px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#5B66A1] sm:w-auto"
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
