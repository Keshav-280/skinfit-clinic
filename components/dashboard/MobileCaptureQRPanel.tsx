"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import QRCode from "qrcode";
import {
  ArrowLeft,
  RefreshCw,
  Smartphone,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type MobileCaptureImageRef = {
  label: string;
  imageUrl: string;
  previewUrl?: string;
};

interface MobileCaptureQRPanelProps {
  onBack: () => void;
  onPhotosReady: (captureImages: MobileCaptureImageRef[]) => void;
  /** Phone finished a full scan on-device (continue-on-phone path). */
  onScanComplete?: (scanId: number) => void;
  isOnboardingScan?: boolean;
}

export function MobileCaptureQRPanel({
  onBack,
  onPhotosReady,
  onScanComplete,
  isOnboardingScan = false,
}: MobileCaptureQRPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>("");
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [status, setStatus] = useState<
    "pending" | "photos_ready" | "complete" | "expired"
  >("pending");
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const onPhotosReadyRef = useRef(onPhotosReady);
  const onScanCompleteRef = useRef(onScanComplete);

  useEffect(() => {
    onPhotosReadyRef.current = onPhotosReady;
  }, [onPhotosReady]);

  useEffect(() => {
    onScanCompleteRef.current = onScanComplete;
  }, [onScanComplete]);

  const fetchSession = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setStatus("pending");

      const res = await fetch("/api/mobile-capture/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variant: isOnboardingScan ? "onboarding" : "dashboard",
        }),
      });

      if (!res.ok) {
        throw new Error(
          "Failed to create session. Please check your authentication.",
        );
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to create session.");
      }

      setSessionId(data.sessionId);

      const qrDataUrl = await QRCode.toDataURL(data.url, {
        width: 280,
        margin: 2,
        color: {
          dark: "#2C3E6B",
          light: "#FFFFFF",
        },
      });
      setQrCodeUrl(qrDataUrl);
      setLoading(false);
    } catch (err: unknown) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Failed to load session QR code.",
      );
      setLoading(false);
    }
  }, [isOnboardingScan]);

  useEffect(() => {
    void fetchSession();

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [fetchSession]);

  useEffect(() => {
    if (!sessionId || status !== "pending") return;

    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/mobile-capture/status?sessionId=${sessionId}`,
        );
        if (!res.ok) return;
        const data = await res.json();

        if (data.success) {
          if (data.status === "photos_ready") {
            setStatus("photos_ready");
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            if (Array.isArray(data.captureImages) && data.captureImages.length > 0) {
              setTimeout(() => {
                onPhotosReadyRef.current(data.captureImages);
              }, 600);
            } else {
              setError(
                "Photos were sent from your phone, but the desktop could not load them. Generate a new QR code and try again.",
              );
              setStatus("pending");
            }
          } else if (data.status === "complete") {
            setStatus("complete");
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            const scanId = Number(data.scanId);
            if (Number.isFinite(scanId) && scanId >= 1) {
              setTimeout(() => {
                onScanCompleteRef.current?.(scanId);
              }, 900);
            }
          } else if (data.status === "expired") {
            setStatus("expired");
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          }
        }
      } catch (err) {
        console.error("Error polling capture status:", err);
      }
    }, 2000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [sessionId, status]);

  return (
    <div className="mx-auto w-full rounded-[24px] border border-[#E5E7EB] bg-white p-6 shadow-[0_8px_32px_rgba(44,62,107,0.07)] md:p-8">
      <button
        type="button"
        onClick={onBack}
        className="mb-5 flex items-center gap-2 text-sm font-semibold text-[#64748B] transition hover:text-[#2C3E6B]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to upload
      </button>

      {!isOnboardingScan ? (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-[#E8F5E9] bg-[#F8FBF8] px-4 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E8F5E9] text-[#2E7D32]">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="min-w-0 text-left">
            <p className="text-sm font-bold text-[#2C3E6B]">Phone capture</p>
            <p className="text-xs leading-relaxed text-[#64748B]">
              Scan the code with your phone camera app — no app install needed.
            </p>
          </div>
        </div>
      ) : (
        <div className="mb-5 text-center">
          <h2 className="text-xl font-extrabold tracking-tight text-[#2C3E6B]">
            Scan with your phone
          </h2>
          <p className="mt-1.5 text-sm text-[#64748B]">
            Complete the guided face capture on your phone.
          </p>
        </div>
      )}

      <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-[#E8EFE6] bg-[#F8FBF8] p-4">
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3"
            >
              <Loader2 className="h-10 w-10 animate-spin text-[#2C3E6B]" />
              <p className="text-sm font-medium text-[#64748B]">
                Generating secure link...
              </p>
            </motion.div>
          )}

          {error && !loading && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center p-4 text-center"
            >
              <AlertTriangle className="h-10 w-10 text-rose-500" />
              <p className="mt-3 text-sm font-semibold text-rose-900">
                {error}
              </p>
              <button
                type="button"
                onClick={fetchSession}
                className="mt-4 flex items-center gap-2 rounded-xl bg-[#2C3E6B] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#354A7A]"
              >
                <RefreshCw className="h-3 w-3" />
                Try again
              </button>
            </motion.div>
          )}

          {!loading && !error && status === "pending" && (
            <motion.div
              key="qr"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center"
            >
              {qrCodeUrl && (
                <div className="rounded-2xl bg-white p-4 shadow-[0_4px_20px_rgba(44,62,107,0.08)] ring-1 ring-[#E5E7EB]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrCodeUrl}
                    alt="Scan to capture photos"
                    className="h-[240px] w-[240px]"
                  />
                </div>
              )}

              <div className="mt-4 flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">
                <Smartphone className="h-3.5 w-3.5 animate-pulse" />
                Waiting for phone photos...
              </div>
            </motion.div>
          )}

          {(status === "photos_ready" || status === "complete") && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center"
            >
              <CheckCircle className="h-16 w-16 text-emerald-500" />
              <h3 className="mt-4 text-lg font-bold text-[#2C3E6B]">
                Photos received!
              </h3>
              <p className="mt-2 text-sm text-[#64748B]">
                Loading them into your desktop scan preview now.
              </p>
            </motion.div>
          )}

          {status === "expired" && (
            <motion.div
              key="expired"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center"
            >
              <AlertTriangle className="h-12 w-12 text-amber-500" />
              <h3 className="mt-4 text-base font-bold text-[#2C3E6B]">
                QR code expired
              </h3>
              <p className="mt-2 text-xs text-[#64748B]">
                For security, QR codes expire after 15 minutes.
              </p>
              <button
                type="button"
                onClick={fetchSession}
                className="mt-4 flex items-center gap-2 rounded-xl bg-[#2C3E6B] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#354A7A]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Generate new QR
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-5 border-t border-[#E8EFE6] pt-4 text-center">
        <p className="text-xs text-[#94A3B8]">
          Secure transfer · session expires in 15 minutes
        </p>
      </div>
    </div>
  );
}
