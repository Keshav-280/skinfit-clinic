"use client";

import { useState } from "react";
import { ScanDetectionOverlay } from "@/components/dashboard/ScanDetectionOverlay";
import type { ConcernChipId } from "@/components/dashboard/ConcernChips";
import type {
  DetectionRegion,
  ProxyRegion,
  WrinkleLine,
} from "@/src/lib/scanDetectionRegions";

type ConceptFaceProps = {
  url: string;
  label?: string;
  regions: DetectionRegion[];
  proxyRegions: ProxyRegion[];
  wrinkleLines: WrinkleLine[];
  activeConcern: ConcernChipId;
  circular?: boolean;
  className?: string;
};

export function ConceptFace({
  url,
  label = "Front",
  regions,
  proxyRegions,
  wrinkleLines,
  activeConcern,
  circular = false,
  className = "",
}: ConceptFaceProps) {
  const [ready, setReady] = useState(false);
  const showWrinkles = activeConcern === "all" || activeConcern === "wrinkles";

  return (
    <div
      className={`relative overflow-hidden bg-[#2A2430] ${
        circular ? "rounded-full" : ""
      } ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={label}
        onLoad={() => setReady(true)}
        onError={() => setReady(true)}
        className={`h-full w-full ${circular ? "object-cover" : "object-contain"} object-center`}
        draggable={false}
      />
      {ready ? (
        <ScanDetectionOverlay
          regions={regions}
          wrinkleLines={showWrinkles ? wrinkleLines : []}
          proxyRegions={proxyRegions}
          activeConcern={activeConcern}
        />
      ) : null}
    </div>
  );
}
