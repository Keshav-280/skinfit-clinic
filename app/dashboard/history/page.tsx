import React from "react";
import { redirect } from "next/navigation";
import { db } from "../../../src/db";
import {
  doctorFeedbackVoiceNotes,
  scans,
  users,
  visitNotes,
} from "../../../src/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { HistoryView } from "../../../components/dashboard/HistoryView";
import { getSessionUserId } from "../../../src/lib/auth/get-session";
import { ymdFromDateOnly } from "../../../src/lib/date-only";
import { displayUserPhone } from "../../../src/lib/auth/phone";
import { patientScanImagePath } from "../../../src/lib/patientScanImagePath";

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
    const eczema = Math.min(
      100,
      Math.max(0, Math.round((s.hydration + s.acne + s.texture) / 3))
    );
    return {
      id: s.id,
      scanName: s.scanName,
      imageUrl: patientScanImagePath(s.id, { preview: true, thumbnail: true }),
      overallScore: s.overallScore,
      acne: s.acne,
      pigmentation: s.pigmentation,
      wrinkles: s.wrinkles,
      hydration: s.hydration,
      texture: s.texture,
      eczema,
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
  }));

  const mapReport = (r: (typeof reportVoiceRows)[number]) => ({
    id: r.id,
    scanId: r.scanId!,
    scanLabel: r.scanName?.trim() || "Report",
    audioDataUri: r.audioDataUri,
    createdAt: r.createdAt,
    listened: r.patientListenedAt != null,
  });

  const reportVoiceNotes = reportVoiceRows
    .filter((r) => r.patientArchivedAt == null)
    .map(mapReport);
  const reportVoiceNotesArchived = reportVoiceRows
    .filter((r) => r.patientArchivedAt != null)
    .map(mapReport);

  return (
    <div className="space-y-6">
      <h1 className="text-center text-2xl font-bold tracking-tight text-zinc-900">
        Treatment History
      </h1>
      <HistoryView
        scans={scanRecords}
        visitNotes={visitRecords}
        reportVoiceNotes={reportVoiceNotes}
        reportVoiceNotesArchived={reportVoiceNotesArchived}
        patient={patient}
      />
    </div>
  );
}
