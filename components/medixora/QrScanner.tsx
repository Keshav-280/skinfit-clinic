"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { ImageUp, X } from "lucide-react";

type Detector = { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> };

function nativeDetector(): Detector | null {
  const Ctor = (window as unknown as { BarcodeDetector?: new (o: object) => Detector }).BarcodeDetector;
  try {
    return Ctor ? new Ctor({ formats: ["qr_code"] }) : null;
  } catch {
    return null;
  }
}

/** Reads a QR from one frame or picture. `crop` keeps only the centre square, at higher detail. */
function decode(
  canvas: HTMLCanvasElement,
  source: CanvasImageSource,
  width: number,
  height: number,
  crop: number
): string | null {
  const side = Math.min(width, height) * crop;
  const sw = crop < 1 ? side : width;
  const sh = crop < 1 ? side : height;
  const scale = Math.min(1, 1100 / Math.max(sw, sh));
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || !canvas.width || !canvas.height) return null;
  ctx.drawImage(source, (width - sw) / 2, (height - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(pixels.data, canvas.width, canvas.height)?.data || null;
}

/** Camera QR reader that stays on this page. Also accepts a photo of the QR. */
export function QrScanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const done = useRef(false);
  const [problem, setProblem] = useState("");
  const result = useRef(onResult);
  result.current = onResult;

  useEffect(() => {
    done.current = false;
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const detector = nativeDetector();
    let pass = 0;

    const tick = async () => {
      const v = video.current;
      if (stopped || done.current) return;
      if (v && v.readyState >= 2 && v.videoWidth) {
        let text: string | null = null;
        try {
          text = detector ? ((await detector.detect(v))[0]?.rawValue ?? null) : null;
        } catch {
          /* fall back to the library below */
        }
        // Alternate between the centre (small or far codes) and the whole frame.
        text ??= decode(canvas, v, v.videoWidth, v.videoHeight, pass++ % 2 === 0 ? 0.7 : 1);
        if (text && !stopped && !done.current) {
          done.current = true;
          result.current(text);
          return;
        }
      }
      timer = window.setTimeout(tick, 150);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setProblem("This browser cannot open the camera. Upload a photo of the QR, or paste the link.");
        return;
      }
      try {
        const opened = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (stopped) {
          opened.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = opened;
        const v = video.current!;
        v.srcObject = opened;
        await v.play().catch(() => {});
        void tick();
      } catch {
        setProblem("Camera access was blocked. Allow the camera for this site, upload a photo of the QR, or paste the link.");
      }
    })();

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function readPhoto(file: File) {
    setProblem("");
    const url = URL.createObjectURL(file);
    try {
      const img = new window.Image();
      img.src = url;
      await img.decode();
      const canvas = document.createElement("canvas");
      let text: string | null = null;
      for (const crop of [1, 0.8, 0.6, 0.4]) {
        text = decode(canvas, img, img.naturalWidth, img.naturalHeight, crop);
        if (text) break;
      }
      if (text) {
        done.current = true;
        onResult(text);
      } else setProblem("No QR found in that photo. Take it closer and straight on.");
    } catch {
      setProblem("That file could not be read.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return (
    <div className="rounded-2xl border border-[#E4E6F0] bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[#1E1B31]">Point the camera at the QR on the Medixora screen</p>
        <button type="button" onClick={onClose} aria-label="Close scanner" className="rounded-lg p-1.5 text-[#5B66A1] hover:bg-[#F0EAE2]">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <div className="relative mx-auto mt-3 aspect-square w-full max-w-sm overflow-hidden rounded-xl bg-[#1E1B31]">
        <video ref={video} muted playsInline className="h-full w-full object-cover" />
        <span className="pointer-events-none absolute inset-[15%] rounded-xl border-2 border-white/80" aria-hidden />
      </div>
      {problem ? (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {problem}
        </p>
      ) : null}
      <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 text-sm font-semibold text-[#1E1B31] underline">
        <ImageUp className="h-4 w-4" aria-hidden />
        Upload a photo of the QR
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void readPhoto(file);
          }}
        />
      </label>
    </div>
  );
}
