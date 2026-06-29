"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Camera, RefreshCw, Smartphone, CheckCircle, AlertTriangle, Loader2, ChevronLeft, X, Check, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { FACE_SCAN_CAPTURE_STEPS } from "@/src/lib/faceScanCaptures";
import { useWebScanCaptureGuidance } from "@/src/hooks/useWebScanCaptureGuidance";
import { CaptureFaceGuideOverlayWeb } from "@/components/dashboard/CaptureFaceGuideOverlayWeb";
import { captureVoiceGuide } from "@/src/lib/captureVoiceGuide";
import { resolveCaptureVoiceHint } from "@/src/lib/captureVoiceHint";

interface MobileCaptureFlowProps {
  sessionId: string;
  token: string;
}

type StepState = "intro" | "camera" | "review" | "submitting" | "success" | "error";

interface CaptureItem {
  file: File;
  preview: string;
  label: string;
}

const N_STEPS = FACE_SCAN_CAPTURE_STEPS.length;

export function MobileCaptureFlow({ sessionId, token }: MobileCaptureFlowProps) {
  const [stepState, setStepState] = useState<StepState>("intro");
  const [slotCaptures, setSlotCaptures] = useState<(CaptureItem | null)[]>(() =>
    Array.from({ length: N_STEPS }, () => null)
  );
  const [cameraStepIndex, setCameraStepIndex] = useState(0);
  const [pendingCapture, setPendingCapture] = useState<CaptureItem | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const currentCameraStep = FACE_SCAN_CAPTURE_STEPS[Math.min(cameraStepIndex, N_STEPS - 1)];
  const reviewingCapture = pendingCapture != null;
  const guidanceActive = stepState === "camera" && !reviewingCapture;

  // Guidance hook
  const { guidance, faceTracked } = useWebScanCaptureGuidance(
    videoRef,
    guidanceActive,
    1.0, // zoom
    currentCameraStep.id,
    "brightness(100%) contrast(100%)"
  );

  // Voice guidance
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  useEffect(() => {
    captureVoiceGuide.setEnabled(voiceEnabled && stepState === "camera");
    if (!voiceEnabled || stepState !== "camera") captureVoiceGuide.reset();
    return () => {
      captureVoiceGuide.setEnabled(false);
    };
  }, [voiceEnabled, stepState]);

  useEffect(() => {
    if (!voiceEnabled || stepState !== "camera" || reviewingCapture || !guidance) return;
    const hint = resolveCaptureVoiceHint(guidance);
    if (!hint) return;
    captureVoiceGuide.speak(hint.text, hint.priority, hint.key);
  }, [voiceEnabled, stepState, reviewingCapture, guidance]);

  // Clean up previews on unmount
  useEffect(() => {
    return () => {
      slotCaptures.forEach((c) => {
        if (c) URL.revokeObjectURL(c.preview);
      });
      if (pendingCapture) URL.revokeObjectURL(pendingCapture.preview);
      stopCamera();
    };
  }, [slotCaptures, pendingCapture]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const startCamera = async (facing: "user" | "environment") => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera is not supported on this browser.");
      return;
    }
    setCameraError(null);
    stopCamera();

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
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        void videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.error(err);
      setCameraError("Could not access camera. Please allow camera permissions in your browser.");
    }
  };

  const handleStartCapture = async () => {
    setStepState("camera");
    setCameraStepIndex(0);
    setPendingCapture(null);
    await startCamera("user");
  };

  const handleFlipCamera = async () => {
    const nextFacing = facingMode === "user" ? "environment" : "user";
    await startCamera(nextFacing);
  };

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || !streamRef.current || pendingCapture) return;

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Mirror for front camera
    if (facingMode === "user") {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, w, h);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `face-scan-${currentCameraStep.id}.jpg`, {
          type: "image/jpeg",
        });
        const preview = URL.createObjectURL(blob);
        setPendingCapture({
          file,
          preview,
          label: currentCameraStep.id,
        });
      },
      "image/jpeg",
      0.88
    );
  };

  const handleConfirmCapture = () => {
    if (!pendingCapture) return;

    const currentPending = pendingCapture;
    setPendingCapture(null);

    setSlotCaptures((prev) => {
      const next = [...prev];
      if (next[cameraStepIndex]) {
        URL.revokeObjectURL(next[cameraStepIndex]!.preview);
      }
      next[cameraStepIndex] = currentPending;

      const allFilled = next.every((s) => s !== null);
      if (allFilled) {
        stopCamera();
        setStepState("review");
      } else {
        // Find next empty step
        const nextEmpty = next.findIndex((s) => s === null);
        setCameraStepIndex(nextEmpty >= 0 ? nextEmpty : cameraStepIndex + 1);
      }
      return next;
    });
  };

  const handleRetakeCapture = () => {
    if (pendingCapture) {
      URL.revokeObjectURL(pendingCapture.preview);
      setPendingCapture(null);
    }
  };

  const handleRetakeSlot = async (index: number) => {
    setCameraStepIndex(index);
    setPendingCapture(null);
    setStepState("camera");
    await startCamera("user");
  };

  const handleSubmit = async () => {
    setStepState("submitting");
    setSubmitError(null);

    const formData = new FormData();
    formData.append("scanName", "Mobile Phone Scan");
    formData.append("captureSource", "mobile-web");
    formData.append("sessionId", sessionId);

    slotCaptures.forEach((c) => {
      if (c) formData.append("images", c.file);
    });

    try {
      const res = await fetch("/api/mobile-capture/submit", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || `Submission failed (${res.status})`);
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to analyze skin.");
      }

      setStepState("success");
    } catch (err: unknown) {
      console.error(err);
      setSubmitError(err instanceof Error ? err.message : "An error occurred during submission.");
      setStepState("error");
    }
  };

  // Progress percentage
  const progressPercent = ((slotCaptures.filter(Boolean).length) / N_STEPS) * 100;

  return (
    <div className="flex min-h-screen flex-col bg-[#0F172A] text-slate-100 font-sans">
      <AnimatePresence mode="wait">
        {/* Step: Intro */}
        {stepState === "intro" && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="flex flex-1 flex-col items-center justify-between p-6 md:p-12"
          >
            <div className="flex-1 flex flex-col items-center justify-center max-w-md text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
                <Smartphone className="h-8 w-8" />
              </div>
              <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-white">
                Mobile Face Capture
              </h1>
              <p className="mt-3 text-base text-slate-400 leading-relaxed">
                Take high-quality skin scans with your phone's camera. We will guide you through 5 angles.
              </p>

              <div className="mt-8 space-y-4 w-full text-left bg-slate-900/50 p-5 rounded-2xl border border-slate-800">
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-300">1</div>
                  <p className="text-sm text-slate-300">Find a room with bright, natural lighting.</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-300">2</div>
                  <p className="text-sm text-slate-300">Remove glasses, make-up, or hair covering your face.</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-300">3</div>
                  <p className="text-sm text-slate-300">Hold your phone steady and follow the voice guide.</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleStartCapture}
              className="mt-8 w-full max-w-md flex items-center justify-center gap-2 rounded-2xl bg-[#E07088] py-4 text-base font-bold text-white shadow-lg shadow-[#E07088]/20 transition hover:bg-[#d06078] active:scale-95"
            >
              Start Guided Capture
              <ArrowRight className="h-4 w-4" />
            </button>
          </motion.div>
        )}

        {/* Step: Camera */}
        {stepState === "camera" && (
          <motion.div
            key="camera"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative flex flex-1 flex-col overflow-hidden"
          >
            {/* Header progress bar */}
            <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent p-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    stopCamera();
                    setStepState("intro");
                  }}
                  className="rounded-full bg-white/10 p-2 text-white backdrop-blur-sm transition hover:bg-white/20"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="h-1.5 flex-1 rounded-full bg-white/20 overflow-hidden">
                  <div
                    className="h-full bg-[#E07088] transition-all duration-300"
                    style={{ width: `${((cameraStepIndex) / N_STEPS) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-bold tracking-wider tabular-nums text-white bg-black/40 px-2.5 py-1 rounded-full backdrop-blur-sm">
                  {cameraStepIndex + 1}/{N_STEPS}
                </span>
              </div>

              {/* Guidance text bar */}
              <div className="mt-3 flex justify-center">
                <div className={`rounded-full px-4 py-1.5 text-xs font-extrabold shadow-md backdrop-blur-sm transition-all ${
                  guidance?.readyToCapture
                    ? "bg-emerald-500/90 text-white animate-pulse"
                    : "bg-amber-500/90 text-slate-950"
                }`}>
                  {guidance ? (
                    guidance.readyToCapture ? "Perfect, hold still!" : guidance.faceMessage || guidance.lightingMessage || "Align your face"
                  ) : "Starting camera guidance..."}
                </div>
              </div>
            </div>

            {/* Camera viewfinder */}
            <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
              {cameraError ? (
                <div className="p-6 text-center max-w-sm">
                  <AlertTriangle className="mx-auto h-12 w-12 text-rose-500" />
                  <p className="mt-4 text-sm font-semibold text-rose-300">{cameraError}</p>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    className={`absolute inset-0 h-full w-full object-cover ${reviewingCapture ? "invisible" : ""}`}
                    style={{
                      transform: facingMode === "user" ? "scaleX(-1)" : "none",
                    }}
                    playsInline
                    muted
                    autoPlay
                  />

                  {pendingCapture && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={pendingCapture.preview}
                      alt="Captured snapshot"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}

                  {!reviewingCapture && (
                    <CaptureFaceGuideOverlayWeb stepId={currentCameraStep.id} />
                  )}
                </>
              )}
            </div>

            {/* Bottom controls */}
            <div className="bg-slate-950/95 border-t border-slate-900 px-6 py-6 flex flex-col gap-4">
              <div className="text-center">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                  {currentCameraStep.title}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {currentCameraStep.subtitle}
                </p>
              </div>

              <div className="flex items-center justify-between mt-2">
                {/* Flip camera */}
                <button
                  onClick={handleFlipCamera}
                  disabled={reviewingCapture}
                  className="rounded-full bg-slate-900 border border-slate-800 p-3.5 text-slate-300 transition hover:bg-slate-800 disabled:opacity-30"
                  aria-label="Flip camera"
                >
                  <RefreshCw className="h-5 w-5" />
                </button>

                {/* Shutter button */}
                {reviewingCapture ? (
                  <div className="flex items-center gap-3 flex-1 px-4">
                    <button
                      onClick={handleRetakeCapture}
                      className="flex-1 rounded-xl border border-rose-500/30 bg-rose-500/10 py-3 text-sm font-bold text-rose-400 transition hover:bg-rose-500/20"
                    >
                      Retake
                    </button>
                    <button
                      onClick={handleConfirmCapture}
                      className="flex-1 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-white transition hover:bg-emerald-600 shadow-md"
                    >
                      Use Photo
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleCapture}
                    disabled={!guidance?.readyToCapture}
                    className={`h-20 w-20 rounded-full border-4 flex items-center justify-center transition-all ${
                      guidance?.readyToCapture
                        ? "border-emerald-400 bg-emerald-500 shadow-lg shadow-emerald-500/35 scale-105"
                        : "border-slate-700 bg-slate-800 opacity-60"
                    }`}
                    aria-label="Capture photo"
                  >
                    <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                      <Camera className="h-5 w-5 text-white" />
                    </div>
                  </button>
                )}

                {/* Voice toggle */}
                <button
                  onClick={() => setVoiceEnabled(!voiceEnabled)}
                  className={`rounded-full border p-3.5 transition ${
                    voiceEnabled
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                      : "border-slate-800 bg-slate-900 text-slate-400"
                  }`}
                  aria-label={voiceEnabled ? "Mute guidance" : "Unmute guidance"}
                >
                  {voiceEnabled ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M12 18.75V5.25L7.75 9.5H4.5v5h3.25L12 18.75z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step: Review */}
        {stepState === "review" && (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="flex flex-1 flex-col p-6 max-w-md mx-auto justify-between"
          >
            <div>
              <div className="text-center mb-6">
                <h1 className="text-2xl font-extrabold text-white">Review Photos</h1>
                <p className="text-sm text-slate-400 mt-1">
                  Ensure all angles are clear and well lit before submitting.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {slotCaptures.map((capture, index) => {
                  const stepMeta = FACE_SCAN_CAPTURE_STEPS[index];
                  return (
                    <div
                      key={stepMeta.id}
                      className="relative rounded-2xl bg-slate-900 border border-slate-800 p-2.5 flex flex-col items-center"
                    >
                      {capture ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={capture.preview}
                            alt={stepMeta.title}
                            className="h-28 w-full rounded-xl object-cover"
                          />
                          <p className="mt-2 text-xs font-bold text-slate-200">
                            {stepMeta.title}
                          </p>
                          <button
                            onClick={() => handleRetakeSlot(index)}
                            className="mt-2 w-full text-center py-1.5 rounded-lg bg-slate-800 text-[11px] font-extrabold text-[#E07088] transition hover:bg-slate-700"
                          >
                            Retake
                          </button>
                        </>
                      ) : (
                        <div className="h-28 flex flex-col items-center justify-center">
                          <AlertTriangle className="h-6 w-6 text-amber-500" />
                          <p className="text-[10px] font-bold text-slate-400 mt-2">Missing Angle</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 space-y-3">
              <button
                onClick={handleSubmit}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 text-base font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-600 active:scale-95"
              >
                Looks Good — Submit Scan
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setSlotCaptures(Array.from({ length: N_STEPS }, () => null));
                  void handleStartCapture();
                }}
                className="w-full text-center py-3 text-sm font-semibold text-slate-400 transition hover:text-slate-200"
              >
                Reset & Start Over
              </button>
            </div>
          </motion.div>
        )}

        {/* Step: Submitting */}
        {stepState === "submitting" && (
          <motion.div
            key="submitting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-1 flex-col items-center justify-center p-6 text-center"
          >
            <Loader2 className="h-12 w-12 animate-spin text-[#E07088]" />
            <h2 className="mt-6 text-xl font-extrabold text-white">Analyzing Your Skin</h2>
            <p className="mt-2 text-sm text-slate-400 max-w-xs leading-relaxed">
              We are enqueuing your images and running the AI face detection model. This takes about 5 to 10 seconds.
            </p>
          </motion.div>
        )}

        {/* Step: Success */}
        {stepState === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-1 flex-col items-center justify-center p-6 text-center max-w-sm mx-auto"
          >
            <div className="rounded-full bg-emerald-500/10 p-4 ring-1 ring-emerald-500/20 animate-bounce">
              <CheckCircle className="h-16 w-16 text-emerald-400" />
            </div>
            <h2 className="mt-6 text-2xl font-extrabold text-white">Analysis Submitted!</h2>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed">
              Your photos have been received and analyzed successfully. Check your computer screen to view the detailed skin analysis report.
            </p>
            <p className="mt-6 text-xs text-slate-500">
              You can safely close this browser tab now.
            </p>
          </motion.div>
        )}

        {/* Step: Error */}
        {stepState === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-1 flex-col items-center justify-center p-6 text-center max-w-sm mx-auto"
          >
            <div className="rounded-full bg-rose-500/10 p-4 ring-1 ring-rose-500/20">
              <AlertTriangle className="h-12 w-12 text-rose-400" />
            </div>
            <h2 className="mt-6 text-xl font-extrabold text-white">Submission Failed</h2>
            <p className="mt-3 text-sm text-rose-300 leading-relaxed bg-rose-950/20 border border-rose-900/30 p-4 rounded-xl">
              {submitError || "An error occurred while uploading and analyzing your face scan."}
            </p>
            <button
              onClick={() => setStepState("review")}
              className="mt-8 w-full rounded-2xl bg-slate-800 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-slate-700 active:scale-95"
            >
              Back to Review
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
