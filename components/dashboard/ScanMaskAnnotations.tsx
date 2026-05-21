"use client";

import type { ScanSpatialOutputs } from "@/src/lib/spatialOutputs";
import { DOT_MARKER_LEGEND } from "@/src/lib/scanMaskLabels";
import type { ReportRegion } from "./scanReportTypes";

function regionMarkerColor(issue: string): string {
  const x = issue.toLowerCase();
  if (x.includes("acne")) return "#dc2626";
  if (x.includes("wrinkle")) return "#7c3aed";
  return "#6b7280";
}

/** Mask PNGs from inference already include matplotlib titles above each panel. */
export function ScanMaskAnnotations({
  imageUrl,
  wrinkleMaskUrl,
  acneMaskUrl,
  spatialOutputs: _spatialOutputs,
  regions,
}: {
  imageUrl: string;
  wrinkleMaskUrl?: string;
  acneMaskUrl?: string;
  wrinklePoseLabel?: string;
  acnePoseLabel?: string;
  spatialOutputs?: ScanSpatialOutputs;
  regions: ReportRegion[];
}) {
  const wrinkle = wrinkleMaskUrl?.trim() || "";
  const acne = acneMaskUrl?.trim() || "";
  const showDotMarkers =
    !wrinkle && !acne && regions.length > 0 && imageUrl?.trim();

  if (!wrinkle && !acne && !showDotMarkers) return null;

  return (
    <div className="mx-auto mt-8 max-w-2xl break-inside-avoid">
      {(wrinkle || acne) && (
        <div
          className={`mx-auto grid gap-4 ${
            wrinkle && acne ? "grid-cols-1 sm:grid-cols-2" : "max-w-[280px]"
          }`}
        >
          {wrinkle ? (
            <figure className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-zinc-200/80">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={wrinkle}
                alt="Wrinkle mask overlay"
                className="h-auto w-full object-contain"
              />
            </figure>
          ) : null}
          {acne ? (
            <figure className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-zinc-200/80">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={acne}
                alt="Acne objectness overlay"
                className="h-auto w-full object-contain"
              />
            </figure>
          ) : null}
        </div>
      )}

      {showDotMarkers ? (
        <div className="mx-auto mt-6 max-w-[280px]">
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-zinc-200 ring-1 ring-zinc-300/80">
            <img
              src={imageUrl}
              alt="Scan with highlighted areas"
              className="h-full w-full object-cover object-center"
            />
            {regions.map((r, i) => (
              <div
                key={`${r.issue}-${i}`}
                className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
                style={{
                  left: `${r.coordinates.x}%`,
                  top: `${r.coordinates.y}%`,
                  backgroundColor: regionMarkerColor(r.issue),
                }}
                title={r.issue}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-3">
            {DOT_MARKER_LEGEND.items.map((item) => (
              <span
                key={item.label}
                className="inline-flex items-center gap-1.5 text-xs text-zinc-700"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                {item.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
