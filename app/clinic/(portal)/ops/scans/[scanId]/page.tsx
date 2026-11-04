import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { scans } from "@/src/db/schema";
import { buildDoctorScanReportPayload } from "@/src/lib/doctorScanReportPayload";
import {
  parseScanDetectionRegions,
  parseScanDetectionRegionsByPose,
} from "@/src/lib/scanDetectionRegions";
import {
  parseScanSpotAnnotatedByPose,
  parseScanSpotAnnotatedUrl,
  parseSuppressedAnnotationPoses,
} from "@/src/lib/parseClinicalScores";
import { OpsScanInspector } from "@/components/ops/OpsScanInspector";

export const dynamic = "force-dynamic";

export default async function OpsScanDetail({
  params,
}: {
  params: Promise<{ scanId: string }>;
}) {
  const id = Number((await params).scanId);
  if (!Number.isInteger(id)) notFound();
  const row = await db.query.scans.findFirst({ where: eq(scans.id, id) });
  if (!row) notFound();
  const payload = await buildDoctorScanReportPayload(row.userId, id);
  if (!payload) notFound();

  const byPose = parseScanDetectionRegionsByPose(row.scores);
  const centre = parseScanDetectionRegions(row.scores);
  const gallery = (payload.faceCaptureGallery ?? []) as Array<{
    label: string;
    imageUrl: string;
    poseId?: string;
  }>;
  // Same source the patient report uses: pre-rendered annotated photos per pose.
  const baked =
    parseScanSpotAnnotatedByPose(row.scores, { includeSuppressed: true }) ??
    (parseScanSpotAnnotatedUrl(row.scores, { includeSuppressed: true })
      ? { centre: parseScanSpotAnnotatedUrl(row.scores, { includeSuppressed: true }) as string }
      : undefined);
  const suppressed = parseSuppressedAnnotationPoses(row.scores);
  const photos = gallery.map((g) => ({
    label: g.label,
    imageUrl: g.imageUrl,
    patientUrl: (g.poseId && baked?.[g.poseId]) || g.imageUrl,
    hasBaked: Boolean(g.poseId && baked?.[g.poseId]),
    poseId: g.poseId ?? "",
    hidden: Boolean(g.poseId && suppressed.includes(g.poseId)),
    regions: (g.poseId && byPose[g.poseId]) || (g.poseId === "centre" ? centre : []),
    isCentre: g.poseId === "centre",
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <Link href="/clinic/ops/scans" className="text-sm font-semibold text-[#2B2F63] underline">
        All scans
      </Link>
      <h1 className="text-xl font-semibold text-[#1E1B31]">
        Scan #{id} · {payload.userName}
      </h1>
      <p className="text-sm text-[#6B7280]">{payload.scanDateIso}</p>
      <OpsScanInspector
        scanId={id}
        photos={photos}
        wrinkleLines={payload.wrinkleLines}
        proxyRegions={payload.proxyRegions}
        scores={(row.scores ?? {}) as Record<string, unknown>}
        stored={{
          overall: row.overallScore,
          acne: row.acne,
          pigmentation: row.pigmentation,
          wrinkles: row.wrinkles,
          hydration: row.hydration,
          texture: row.texture,
        }}
      />
    </div>
  );
}
