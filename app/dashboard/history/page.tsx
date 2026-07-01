import React from "react";
import { redirect } from "next/navigation";
import { db } from "../../../src/db";
import {
  doctorFeedbackVoiceNotes,
  scans,
  users,
  visitNotes,
  clinicExternalReports,
} from "../../../src/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { HistoryView } from "../../../components/dashboard/HistoryView";
import { getSessionUserId } from "../../../src/lib/auth/get-session";
import { ymdFromDateOnly } from "../../../src/lib/date-only";
import { displayUserPhone } from "../../../src/lib/auth/phone";
import { isPatientClinicVisited } from "../../../src/lib/patientClinicVisit";
import { patientScanImagePath } from "../../../src/lib/patientScanImagePath";
import { analysisResultsToParams } from "../../../src/lib/skinScanAnalysis";
import { kaiScoreFromScanRow } from "../../../src/lib/resolveScanDisplayScores";

export default async function HistoryPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

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
  if (!user) redirect("/login");

  const patient = {
    name: user.name,
    email: user.email,
    phone: displayUserPhone(user.phoneCountryCode, user.phone),
    age: user.age,
    skinType: user.skinType,
    primaryGoal: user.primaryGoal,
  };

  const [scansList, visitsList, reportVoiceRows, clinicReportRows, scoresUnlocked] =
    await Promise.all([
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
        createdAt: true,
        aiSummary: true,
        scores: true,
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
    db.query.clinicExternalReports.findMany({
      where: eq(clinicExternalReports.patientUserId, user.id),
      columns: {
        id: true,
        title: true,
        status: true,
        sentAt: true,
        createdAt: true,
        shareToken: true,
      },
      orderBy: [desc(clinicExternalReports.sentAt), desc(clinicExternalReports.createdAt)],
    }),
    isPatientClinicVisited(userId),
  ]);

  const scanRecords = scansList.map((s) => {
    const params = analysisResultsToParams(s.scores, {
      texture: s.texture,
      pigmentation: s.pigmentation,
    });
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
      params,
      createdAt: s.createdAt,
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

  const mapReport = (r: (typeof reportVoiceRows)[number]) => {
    const audio = r.audioDataUri?.trim() || null;
    return {
      id: r.id,
      scanId: r.scanId!,
      scanLabel: r.scanName?.trim() || "Report",
      audioDataUri: audio,
      createdAt: r.createdAt,
      listened: r.patientListenedAt != null,
    };
  };

  const hasAudio = <T extends { audioDataUri: string | null }>(
    row: T
  ): row is T & { audioDataUri: string } => Boolean(row.audioDataUri);

  const reportVoiceNotes = reportVoiceRows
    .filter((r) => r.patientArchivedAt == null)
    .map(mapReport)
    .filter(hasAudio);
  const reportVoiceNotesArchived = reportVoiceRows
    .filter((r) => r.patientArchivedAt != null)
    .map(mapReport)
    .filter(hasAudio);

  const clinicReports = clinicReportRows
    .filter((r) => r.status === "sent")
    .map((r) => ({
      id: r.id,
      title: r.title,
      kind: "external_clinic_report" as const,
      status: r.status,
      createdAt: (r.sentAt ?? r.createdAt).toISOString(),
      downloadUrl: `/api/patient/clinic-reports/${r.id}?download=1`,
    }));

  return (
    <HistoryView
      scans={scanRecords}
      visitNotes={visitRecords}
      clinicReports={clinicReports}
      reportVoiceNotes={reportVoiceNotes}
      reportVoiceNotesArchived={reportVoiceNotesArchived}
      patient={patient}
      scoresUnlocked={scoresUnlocked}
    />
  );
}
