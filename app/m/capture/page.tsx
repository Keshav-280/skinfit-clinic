"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { MobileCaptureFlow } from "@/components/mobile-capture/MobileCaptureFlow";
import { Loader2 } from "lucide-react";

function MobileCaptureContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("s") || "";
  const token = searchParams.get("t") || "";

  if (!sessionId || !token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <div className="rounded-full bg-rose-500/10 p-3 ring-1 ring-rose-500/20">
          <svg className="h-6 w-6 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="mt-4 text-lg font-bold text-slate-200">Invalid Capture Link</h1>
        <p className="mt-2 text-sm text-slate-400 max-w-xs">
          The link is missing session parameters. Please generate a new QR code on your computer.
        </p>
      </div>
    );
  }

  return <MobileCaptureFlow sessionId={sessionId} token={token} />;
}

export default function MobileCapturePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center p-6">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
          <p className="mt-4 text-sm text-slate-400">Loading capture session...</p>
        </div>
      }
    >
      <MobileCaptureContent />
    </Suspense>
  );
}
