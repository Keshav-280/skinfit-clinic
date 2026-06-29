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

interface MobileCaptureQRPanelProps {
  onBack: () => void;
  onComplete: (scanId: number) => void;
  isOnboardingScan?: boolean;
}

export function MobileCaptureQRPanel({
  onBack,
  onComplete,
  isOnboardingScan = false,
}: MobileCaptureQRPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>("");
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [status, setStatus] = useState<"pending" | "complete" | "expired">(
    "pending",
  );
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

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

      // Generate QR Code data URL
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

  // Poll status when sessionId changes
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
          if (data.status === "complete") {
            setStatus("complete");
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            // Wait 1.5s for success animation to play, then trigger completion
            setTimeout(() => {
              onCompleteRef.current(data.scanId);
            }, 1500);
          } else if (data.status === "expired") {
            setStatus("expired");
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          }
        }
      } catch (err) {
        console.error("Error polling capture status:", err);
      }
    }, 3000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [sessionId, status]);

  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-[#2C3E6B]/10 bg-white p-6 shadow-xl backdrop-blur-md md:p-8">
      {/* Back button */}
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-sm font-semibold text-[#2C3E6B]/70 transition hover:text-[#2C3E6B]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to upload
      </button>

      <div className="text-center">
        <h2 className="text-2xl font-extrabold tracking-tight text-[#2C3E6B]">
          Scan with your phone
        </h2>
        <p className="mt-2 text-sm text-[#64748B]">
          Use your phone camera app to scan the QR code and complete the guided
          face capture.
        </p>
      </div>

      <div className="mt-6 flex min-h-[300px] flex-col items-center justify-center rounded-2xl bg-slate-50/50 p-4 ring-1 ring-black/5">
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
              <p className="mt-3 text-sm font-semibold text-rose-950">
                {error}
              </p>
              <button
                onClick={fetchSession}
                className="mt-4 flex items-center gap-2 rounded-xl bg-[#2C3E6B] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#344a82]"
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
                <div className="relative rounded-2xl bg-white p-3 shadow-inner ring-1 ring-[#2C3E6B]/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrCodeUrl}
                    alt="Scan to capture photos"
                    className="h-[240px] w-[240px]"
                  />
                </div>
              )}

              <div className="mt-4 flex items-center gap-2 rounded-full bg-[#EBF2FE] px-3.5 py-1 text-xs font-bold text-[#2C3E6B]">
                <Smartphone className="h-3.5 w-3.5 animate-pulse" />
                Waiting for phone camera...
              </div>
            </motion.div>
          )}

          {status === "complete" && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center"
            >
              <CheckCircle className="h-16 w-16 text-emerald-500 animate-bounce" />
              <h3 className="mt-4 text-lg font-bold text-emerald-950">
                Photos Received!
              </h3>
              <p className="mt-2 text-sm text-emerald-800">
                Processing your face scan now. Hang tight.
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
              <h3 className="mt-4 text-base font-bold text-slate-800">
                QR Code Expired
              </h3>
              <p className="mt-2 text-xs text-slate-500">
                For security, QR codes expire after 15 minutes.
              </p>
              <button
                onClick={fetchSession}
                className="mt-4 flex items-center gap-2 rounded-xl bg-[#2C3E6B] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#344a82]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Generate new QR
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-6 border-t border-slate-100 pt-4 text-center">
        <p className="text-xs text-slate-400">
          Secure end-to-end transfer. The phone session expires automatically
          after 15 minutes.
        </p>
      </div>
    </div>
  );
}
