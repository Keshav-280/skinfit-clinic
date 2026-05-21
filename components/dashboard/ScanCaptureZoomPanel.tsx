"use client";

import { ZoomIn, ZoomOut } from "lucide-react";

type Props = {
  captureZoom: number;
  min: number;
  max: number;
  step: number;
  autoZoomEnabled: boolean;
  onAutoZoomChange: (enabled: boolean) => void;
  onZoomChange: (value: number) => void;
  onZoomDelta: (delta: number) => void;
  faceDetectionAvailable: boolean;
};

export function ScanCaptureZoomPanel({
  captureZoom,
  min,
  max,
  step,
  autoZoomEnabled,
  onAutoZoomChange,
  onZoomChange,
  onZoomDelta,
  faceDetectionAvailable,
}: Props) {
  return (
    <div className="rounded-xl border border-white/60 bg-white/50 px-3 py-2.5 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[#2C3E6B]">Zoom</p>
        <label className="flex cursor-pointer items-center gap-1 text-[10px] text-[#6B7280]">
          <input
            type="checkbox"
            checked={autoZoomEnabled}
            onChange={(e) => onAutoZoomChange(e.target.checked)}
            className="accent-[#2C3E6B]"
          />
          Auto
        </label>
      </div>
      <p className="text-[10px] leading-snug text-[#6B7280]">
        <span className="font-semibold tabular-nums text-[#2C3E6B]">
          {captureZoom.toFixed(1)}×
        </span>
        {faceDetectionAvailable ? " · auto from face" : " · auto from face (skin detect)"}
      </p>
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onZoomDelta(-step)}
          disabled={captureZoom <= min}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/70 bg-white/80 text-[#2C3E6B] disabled:opacity-40"
          aria-label="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={captureZoom}
          onChange={(e) => onZoomChange(parseFloat(e.target.value))}
          className="min-w-0 flex-1 accent-[#2C3E6B]"
          aria-label="Capture zoom level"
        />
        <button
          type="button"
          onClick={() => onZoomDelta(step)}
          disabled={captureZoom >= max}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/70 bg-white/80 text-[#2C3E6B] disabled:opacity-40"
          aria-label="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
