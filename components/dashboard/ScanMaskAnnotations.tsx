"use client";

import type { ReactNode } from "react";
import type { ScanSpatialOutputs } from "@/src/lib/spatialOutputs";
import {
  ACNE_MASK_COPY,
  COMBINED_OVERLAY_COPY,
  DOT_MARKER_LEGEND,
  SCAN_MASK_SECTION,
  WRINKLE_MASK_COPY,
} from "@/src/lib/scanMaskLabels";
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

function MaskCaption({
  title,
  subtitle,
  body,
  note,
  meta,
  tone,
}: {
  title: string;
  subtitle: string;
  body: string;
  note?: string;
  meta?: ReactNode;
  tone: "violet" | "orange";
}) {
  const titleCls =
    tone === "violet" ? "text-violet-900" : "text-orange-900";
  const subCls =
    tone === "violet" ? "text-violet-700/90" : "text-orange-700/90";
  return (
    <figcaption className="space-y-1.5 text-center">
      <p className={`text-[12px] font-bold ${titleCls}`}>{title}</p>
      <p className={`text-[11px] font-semibold ${subCls}`}>{subtitle}</p>
      <p className="text-[10px] leading-snug text-zinc-600">{body}</p>
      {meta}
      {note ? (
        <p className="rounded-lg bg-zinc-50 px-2 py-1.5 text-[10px] leading-snug text-zinc-600 ring-1 ring-zinc-100">
          {note}
        </p>
      ) : null}
    </figcaption>
  );
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
    <div className="mx-auto mt-10 max-w-2xl break-inside-avoid">
      <p className="text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
        {SCAN_MASK_SECTION.title}
      </p>
      <p className="mx-auto mt-2 max-w-md text-center text-xs leading-relaxed text-zinc-600">
        {SCAN_MASK_SECTION.intro}
      </p>

      {(wrinkle || acne) && (
        <div
          className={`mx-auto mt-5 grid gap-5 ${
            wrinkle && acne ? "sm:grid-cols-2" : "max-w-[300px]"
          }`}
        >
          {wrinkle ? (
            <figure className="flex flex-col gap-2">
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-zinc-200 ring-2 ring-violet-300/80">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={wrinkle}
                  alt={WRINKLE_MASK_COPY.title}
                  className="h-full w-full object-cover object-center"
                />
              </div>
              <MaskCaption
                tone="violet"
                title={WRINKLE_MASK_COPY.title}
                subtitle={WRINKLE_MASK_COPY.subtitle}
                body={WRINKLE_MASK_COPY.body}
                meta={
                  spatialOutputs?.wrinkles ? (
                    <>
                      <p className="text-[10px] font-medium text-violet-800">
                        {WRINKLE_MASK_COPY.metaCls}{" "}
                        {fmt15(spatialOutputs.wrinkles.cls_severity_1_5)} ·{" "}
                        {WRINKLE_MASK_COPY.metaSeg}{" "}
                        {fmt15(spatialOutputs.wrinkles.seg_severity_1_5)} ·{" "}
                        {WRINKLE_MASK_COPY.metaCombined}{" "}
                        {fmt15(spatialOutputs.wrinkles.combined_severity_1_5)}
                      </p>
                      <p className="text-[10px] text-zinc-500">
                        {WRINKLE_MASK_COPY.metaHint}
                      </p>
                    </>
                  ) : null
                }
              />
            </figure>
          ) : null}
          {acne ? (
            <figure className="flex flex-col gap-2">
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-zinc-200 ring-2 ring-orange-300/80">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={acne}
                  alt={ACNE_MASK_COPY.title}
                  className="h-full w-full object-cover object-center"
                />
              </div>
              <MaskCaption
                tone="orange"
                title={ACNE_MASK_COPY.title}
                subtitle={ACNE_MASK_COPY.subtitle}
                body={ACNE_MASK_COPY.body}
                note={ACNE_MASK_COPY.pigmentationNote}
                meta={
                  spatialOutputs?.acne ? (
                    <p className="text-[10px] font-medium text-orange-800">
                      {ACNE_MASK_COPY.metaGlobal}{" "}
                      {fmt15(spatialOutputs.acne.global_severity_1_5)} ·{" "}
                      {ACNE_MASK_COPY.metaGridMean}{" "}
                      {spatialOutputs.acne.patch_mean.toFixed(3)}
                    </p>
                  ) : null
                }
              />
            </figure>
          ) : null}
        </div>
      )}

      {overlay ? (
        <figure className="mx-auto mt-8 max-w-[340px]">
          <p className="text-center text-[11px] font-bold text-zinc-800">
            {COMBINED_OVERLAY_COPY.title}
          </p>
          <p className="mx-auto mt-1 max-w-xs text-center text-[10px] leading-snug text-zinc-600">
            {COMBINED_OVERLAY_COPY.body}
          </p>
          <ul className="mx-auto mt-2 max-w-xs space-y-0.5 text-[10px] text-zinc-600">
            {COMBINED_OVERLAY_COPY.bullets.map((line) => (
              <li key={line} className="text-center">
                {line}
              </li>
            ))}
          </ul>
          <div className="relative mt-3 aspect-[3/4] w-full overflow-hidden rounded-2xl bg-zinc-200 ring-1 ring-zinc-300/80">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={overlay}
              alt={COMBINED_OVERLAY_COPY.title}
              className="h-full w-full object-cover object-center"
            />
          </div>
          <p className="mt-2 text-center text-[10px] leading-snug text-zinc-500">
            {COMBINED_OVERLAY_COPY.pigmentationNote}
          </p>
        </figure>
      ) : null}

      {showDotMarkers ? (
        <div className="mx-auto mt-6 max-w-[300px]">
          <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            {DOT_MARKER_LEGEND.title}
          </p>
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-zinc-200 ring-1 ring-zinc-300/80">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Scan with region markers"
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
                className="inline-flex items-center gap-1.5 text-[11px] text-zinc-700"
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
