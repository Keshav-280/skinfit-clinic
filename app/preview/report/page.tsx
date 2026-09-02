"use client";

import { useState } from "react";
import { InitialKaiScanReport } from "@/components/report/InitialKaiScanReport";
import { UpdateKaiScanReport } from "@/components/report/UpdateKaiScanReport";
import { SwissReport } from "@/components/report/concepts/SwissReport";
import { NightScanReport } from "@/components/report/concepts/NightScanReport";
import { OrbitReport } from "@/components/report/concepts/OrbitReport";
import {
  PREVIEW_FACE,
  previewActions,
  previewConceptData,
  previewDetections,
  previewParameters,
  previewProxies,
  previewScanImages,
  previewWrinkles,
} from "./mockData";

const DESIGNS = [
  {
    id: "poster" as const,
    label: "Poster",
    blurb: "Current - grade on the photo, lavender cards.",
  },
  {
    id: "swiss" as const,
    label: "Swiss",
    blurb: "Print clinic - giant letter, sharp edges, almost no chrome.",
  },
  {
    id: "night" as const,
    label: "Night scan",
    blurb: "HUD - dark, brackets, readout. A device, not a brochure.",
  },
  {
    id: "orbit" as const,
    label: "Orbit",
    blurb: "Face in a circle, grades as satellites. Tap a moon.",
  },
];

type DesignId = (typeof DESIGNS)[number]["id"];

export default function ReportPreviewPage() {
  const [design, setDesign] = useState<DesignId>("poster");
  const [mode, setMode] = useState<"initial" | "update">("initial");
  const active = DESIGNS.find((d) => d.id === design) ?? DESIGNS[0]!;

  return (
    <div>
      <div className="sticky top-0 z-50 border-b border-black/10 bg-[#FAF8F5]/95 px-3 py-2 backdrop-blur-md">
        <p className="mx-auto mb-2 max-w-[460px] text-center text-[11px] text-[#5B6478]">
          Concept lab - not live yet. Pick a direction.
        </p>
        <div className="mx-auto flex max-w-[460px] gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {DESIGNS.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDesign(d.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                design === d.id
                  ? "bg-[#1E1B31] text-white"
                  : "bg-white/80 text-[#1E1B31]"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <p className="mx-auto mt-1.5 max-w-[460px] text-center text-[11px] text-[#8B93A4]">
          {active.blurb}
        </p>
        {design === "poster" ? (
          <div className="mx-auto mt-2 flex max-w-[460px] rounded-full bg-white/80 p-1">
            <button
              type="button"
              onClick={() => setMode("initial")}
              className={`flex-1 rounded-full py-1.5 text-[12px] font-semibold ${
                mode === "initial" ? "bg-[#1E1B31] text-white" : "text-[#1E1B31]"
              }`}
            >
              Baseline
            </button>
            <button
              type="button"
              onClick={() => setMode("update")}
              className={`flex-1 rounded-full py-1.5 text-[12px] font-semibold ${
                mode === "update" ? "bg-[#1E1B31] text-white" : "text-[#1E1B31]"
              }`}
            >
              Week 3
            </button>
          </div>
        ) : null}
      </div>

      {design === "swiss" ? <SwissReport data={previewConceptData} /> : null}
      {design === "night" ? <NightScanReport data={previewConceptData} /> : null}
      {design === "orbit" ? <OrbitReport data={previewConceptData} /> : null}

      {design === "poster" && mode === "initial" ? (
        <InitialKaiScanReport
          scanId={0}
          grade="6"
          headline="Your baseline is set. Acne and pigmentation are the two markers we'll watch most closely."
          scanDateLabel="28 Aug 2026"
          position={62}
          subtitle="6 markers mapped"
          synthesis={previewConceptData.takeaway}
          baselineBody="Six markers are now fixed against this capture. Next week measures the same points."
          actions={previewActions}
          parameters={previewParameters}
          scanImages={previewScanImages}
          detectionRegions={previewDetections}
          detectionRegionsByPose={{
            centre: previewDetections,
            left: [],
            right: [],
          }}
          wrinkleLines={previewWrinkles}
          proxyRegions={previewProxies}
          isExistingPatient={false}
          doctorName="Dr. Ruby"
        />
      ) : null}

      {design === "poster" && mode === "update" ? (
        <UpdateKaiScanReport
          scanId={0}
          grade="7"
          headline="Acne eased. Pigment is holding."
          metaLeft="Week 3 · 3-week streak"
          metaRight="28 Aug 2026"
          movementBadge={{ label: "Improving", type: "improving" }}
          subtitle="Up from 6/10 last week"
          position={{ current: 68, previous: 62 }}
          thenNow={{
            previous: { url: PREVIEW_FACE, date: "7 Aug" },
            current: { url: PREVIEW_FACE, date: "28 Aug" },
          }}
          scanImages={previewScanImages}
          detectionRegions={previewDetections}
          detectionRegionsByPose={{
            centre: previewDetections.slice(0, 3),
            left: [],
            right: [],
          }}
          wrinkleLines={previewWrinkles}
          proxyRegions={previewProxies}
          parameters={previewParameters.map((p) =>
            p.key === "active_acne"
              ? {
                  ...p,
                  grade: "6",
                  score10: 6,
                  severity: 2.7,
                  finding: "Fewer active lesions than three weeks ago.",
                }
              : p
          )}
          movementGroups={{
            improved: [
              {
                key: "active_acne",
                name: "Active acne",
                grade: "6",
                gradeColor: "mid",
                finding: "Fewer papules on the chin and right cheek.",
                movement: { tag: "↑ 5→6", type: "up" },
              },
            ],
            holding: [
              {
                key: "pigmentation",
                name: "Pigmentation",
                grade: "6",
                gradeColor: "mid",
                finding: "Malar pigment is steady - keep the UV habit.",
                movement: { tag: "Steady", type: "hold" },
              },
              {
                key: "under_eye",
                name: "Under-eye",
                grade: "7",
                gradeColor: "mid",
                finding: "Shadow unchanged. Sleep was the weak week.",
                movement: { tag: "Steady", type: "hold" },
              },
            ],
            tracking: [
              {
                key: "acne_scars",
                name: "Acne scarring",
                grade: "8",
                gradeColor: "good",
                finding: "Texture reports on a longer cycle.",
                movement: { tag: "Track", type: "track" },
                note: "Next read after week 6.",
              },
            ],
          }}
          attributionCards={[
            {
              label: "Weather",
              text: "UV peaked at 9 in Bengaluru - pigment holding is a win.",
            },
            {
              label: "Habits",
              text: "Sunscreen most days. Sleep dipped twice.",
            },
          ]}
          weekRecap={[
            { label: "Sleep", value: "6.2h" },
            { label: "Stress", value: "Mid" },
            { label: "Water", value: "2L" },
            { label: "Routine", value: "5/7" },
          ]}
          weekHighlight="Sunscreen streak is the likely reason acne eased."
          actions={previewActions}
          nextStep={{
            heading: "Keep this plan for one more week",
            body: "No new actives. Dr. Ruby can look at pigment if it still holds after week 4.",
          }}
          doctorName="Dr. Ruby"
          shareLine="Week 3 · 7/10 · acne improved"
        />
      ) : null}
    </div>
  );
}
