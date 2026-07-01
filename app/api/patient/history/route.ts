import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import {
  doctorFeedbackVoiceNotes,
  scans,
  users,
  visitNotes,
} from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { displayUserPhone } from "@/src/lib/auth/phone";
import { ymdFromDateOnly } from "@/src/lib/date-only";
import { CacheKeys, cacheAside } from "@/src/lib/infra";
import { patientScanImagePath } from "@/src/lib/patientScanImagePath";
import { isPatientClinicVisited } from "@/src/lib/patientClinicVisit";
import { kaiScoreFromScanRow } from "@/src/lib/resolveScanDisplayScores";
export async function GET(request: Request) {
  const userId = await getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const includeVisitsOnly = searchParams.get("include") === "visits";

  if (includeVisitsOnly) {
    const visitsPayload = await cacheAside(
      `${CacheKeys.history(userId)}:visits`,
      300,
      async () => {
        const visitsList = await db.query.visitNotes.findMany({
          where: eq(visitNotes.userId, userId),
          columns: {
            id: true,
            visitDate: true,
            doctorName: true,
            notes: true,
            purpose: true,
            treatments: true,
            responseRating: true,
          },
          orderBy: [desc(visitNotes.visitDate)],
        });

        return {
          visitNotes: visitsList.map((v) => ({
            id: v.id,
            visitDateYmd: ymdFromDateOnly(v.visitDate),
            doctorName: v.doctorName,
            notes: v.notes,
            purpose: v.purpose ?? null,
            treatments: v.treatments ?? null,
            responseRating: v.responseRating ?? null,
          })),
        };
      }
    );

    return NextResponse.json(visitsPayload);
  }

  const payload = await cacheAside(CacheKeys.history(userId), 300, async () => {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        id: true,
        name: true,
        email: true,
        phoneCountryCode: true,
        phone: true,
        age: true,
        skinType: true,
        primaryGoal: true,
      },
    });
    if (!user) {
      throw new Error("NOT_FOUND");
    }

    const patient = {
      name: user.name,
      email: user.email,
      phone: displayUserPhone(user.phoneCountryCode, user.phone),
      age: user.age,
      skinType: user.skinType,
      primaryGoal: user.primaryGoal,
    };

    const [scansList, visitsList, reportVoiceRows] = await Promise.all([
      db.query.scans.findMany({
        where: eq(scans.userId, user.id),
        columns: {
          id: true,
          scanName: true,
          overallScore: true,
          acne: true,
          pigmentation: true,
          wrinkles: true,
          hydration: true,
          texture: true,
          scores: true,
          createdAt: true,
          aiSummary: true,
        },
        orderBy: [desc(scans.createdAt)],
      }),
      db.query.visitNotes.findMany({
        where: eq(visitNotes.userId, user.id),
        columns: {
          id: true,
          visitDate: true,
          doctorName: true,
          notes: true,
          attachments: true,
          purpose: true,
          treatments: true,
          preAdvice: true,
          postAdvice: true,
          prescription: true,
          responseRating: true,
        },
        orderBy: [desc(visitNotes.visitDate)],
      }),
      db
        .select({
          id: doctorFeedbackVoiceNotes.id,
          scanId: doctorFeedbackVoiceNotes.scanId,
          scanName: scans.scanName,
          audioDataUri: doctorFeedbackVoiceNotes.audioDataUri,
          createdAt: doctorFeedbackVoiceNotes.createdAt,
          patientListenedAt: doctorFeedbackVoiceNotes.patientListenedAt,
          patientArchivedAt: doctorFeedbackVoiceNotes.patientArchivedAt,
        })
        .from(doctorFeedbackVoiceNotes)
        .innerJoin(scans, eq(doctorFeedbackVoiceNotes.scanId, scans.id))
        .where(
          and(
            eq(doctorFeedbackVoiceNotes.userId, user.id),
            eq(scans.userId, user.id)
          )
        )
        .orderBy(desc(doctorFeedbackVoiceNotes.createdAt)),
    ]);

  const scanRecords = scansList.map((s) => {
    const analysisResults =
      s.scores && typeof s.scores === "object"
        ? {
            ...(s.scores as Record<string, unknown>),
            texture: s.texture,
            pigmentation: s.pigmentation,
          }
        : {
            acne: s.acne,
            pigmentation: s.pigmentation,
            wrinkles: s.wrinkles,
            hydration: s.hydration,
            texture: s.texture,
          };
    return {
      id: s.id,
      scanName: s.scanName,
      imageUrl: patientScanImagePath(s.id, { preview: true, thumbnail: true }),
      overallScore: kaiScoreFromScanRow({
        overallScore: s.overallScore,
        acne: s.acne,
        wrinkles: s.wrinkles,
        pigmentation: s.pigmentation,
        hydration: s.hydration,
        texture: s.texture,
        scores: s.scores,
      }),
      analysisResults,
      createdAt: s.createdAt.toISOString(),
      aiSummary: s.aiSummary ?? null,
    };
  });

  const visitRecords = visitsList.map((v) => ({
    id: v.id,
    visitDateYmd: ymdFromDateOnly(v.visitDate),
    doctorName: v.doctorName,
    notes: v.notes,
    attachments: v.attachments ?? null,
    purpose: v.purpose ?? null,
    treatments: v.treatments ?? null,
    preAdvice: v.preAdvice ?? null,
    postAdvice: v.postAdvice ?? null,
    prescription: v.prescription ?? null,
    responseRating: v.responseRating ?? null,
  }));

  const mapReport = (r: (typeof reportVoiceRows)[number]) => ({
    id: r.id,
    scanId: r.scanId!,
    scanLabel: r.scanName?.trim() || "Report",
    audioDataUri: r.audioDataUri,
    createdAt: r.createdAt.toISOString(),
    listened: r.patientListenedAt != null,
  });

  const reportVoiceNotes = reportVoiceRows
    .filter((r) => r.patientArchivedAt == null)
    .map(mapReport);
  const reportVoiceNotesArchived = reportVoiceRows
    .filter((r) => r.patientArchivedAt != null)
    .map(mapReport);

    const basePayload = {
      patient,
      scans: scanRecords,
      visitNotes: visitRecords,
      reportVoiceNotes,
      reportVoiceNotesArchived,
    };

    const scoresUnlocked = await isPatientClinicVisited(userId);
    return { ...basePayload, scoresUnlocked };
  }).catch((err: unknown) => {
    if (err instanceof Error && err.message === "NOT_FOUND") return null;
    throw err;
  });

  if (!payload) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json(payload);
}
