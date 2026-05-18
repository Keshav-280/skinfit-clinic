"use client";

import type { ScanSpatialOutputs } from "@/src/lib/spatialOutputs";
import type { ReportRegion } from "./scanReportTypes";

function fmt15(v: number) {
  return v.toFixed(1);
}

function regionMarkerColor(issue: string): string {
  const x = issue.toLowerCase();
  if (x.includes("acne")) return "#dc2626";
  if (x.includes("wrinkle")) return "#7c3aed";
  return "#6b7280";
}

export function ScanMaskAnnotations({
  imageUrl,
  overlayUrl,
  wrinkleMaskUrl,
  acneMaskUrl,
  spatialOutputs,
  regions,
}: {
  imageUrl: string;
  overlayUrl?: string;
  wrinkleMaskUrl?: string;
  acneMaskUrl?: string;
  spatialOutputs?: ScanSpatialOutputs;
  regions: ReportRegion[];
}) {
  const overlay = overlayUrl?.trim() || "";
  const wrinkle = wrinkleMaskUrl?.trim() || "";
  const acne = acneMaskUrl?.trim() || "";
  const showDotMarkers =
    !overlay && !wrinkle && !acne && regions.length > 0 && imageUrl?.trim();

  if (!overlay && !wrinkle && !acne && !showDotMarkers) return null;

  return (
    <div className="mx-auto mt-10 max-w-lg break-inside-avoid">
      <p className="text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
        Model masks &amp; annotations
      </p>
      {(wrinkle || acne) && (
        <div
          className={`mx-auto mt-4 grid gap-4 ${
            wrinkle && acne ? "sm:grid-cols-2" : "max-w-[280px]"
          }`}
        >
          {wrinkle ? (
            <figure className="flex flex-col gap-2">
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-zinc-200 ring-1 ring-violet-300/80">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={wrinkle}
                  alt="Wrinkle probability mask"
                  className="h-full w-full object-cover object-center"
                />
              </div>
              <figcaption className="space-y-1 text-center text-[11px] font-medium text-violet-800">
                <p>224×224 pixel map (segmentation head)</p>
                {spatialOutputs?.wrinkles ? (
                  <p className="text-[10px] font-normal leading-snug text-violet-700/90">
                    Cls {fmt15(spatialOutputs.wrinkles.cls_severity_1_5)} · Seg{" "}
                    {fmt15(spatialOutputs.wrinkles.seg_severity_1_5)} · Combined{" "}
                    {fmt15(spatialOutputs.wrinkles.combined_severity_1_5)}
                  </p>
                ) : null}
              </figcaption>
            </figure>
          ) : null}
          {acne ? (
            <figure className="flex flex-col gap-2">
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-zinc-200 ring-1 ring-orange-300/80">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={acne}
                  alt="Acne detection heatmap"
                  className="h-full w-full object-cover object-center"
                />
              </div>
              <figcaption className="space-y-1 text-center text-[11px] font-medium text-orange-800">
                <p>16×16 patch grid (detection head)</p>
                {spatialOutputs?.acne ? (
                  <p className="text-[10px] font-normal leading-snug text-orange-700/90">
                    Global severity {fmt15(spatialOutputs.acne.global_severity_1_5)}{" "}
                    · Grid mean {spatialOutputs.acne.patch_mean.toFixed(3)}
                  </p>
                ) : null}
              </figcaption>
            </figure>
          ) : null}
        </div>
      )}
      {overlay ? (
        <figure className="mx-auto mt-6 max-w-[320px]">
          <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Combined overlay
          </p>
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-zinc-200 ring-1 ring-zinc-300/80">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={overlay}
              alt="Combined wrinkle and acne overlay"
              className="h-full w-full object-cover object-center"
            />
          </div>
        </figure>
      ) : null}
      {showDotMarkers ? (
        <div className="relative mx-auto mt-4 aspect-[3/4] w-full max-w-[280px] overflow-hidden rounded-2xl bg-zinc-200 ring-1 ring-zinc-300/80">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Scan with detection markers"
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
      ) : null}
    </div>
  );
}
