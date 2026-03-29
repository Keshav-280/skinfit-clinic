import React from "react";
import { redirect } from "next/navigation";
import { db } from "../../../src/db";
import { scans, users, visitNotes } from "../../../src/db/schema";
import { desc, eq } from "drizzle-orm";
import { HistoryView } from "../../../components/dashboard/HistoryView";
import { getSessionUserId } from "../../../src/lib/auth/get-session";
import { ymdFromDateOnly } from "../../../src/lib/date-only";

export default async function HistoryPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!user) redirect("/login");

  const scansList = user
    ? await db.query.scans.findMany({
        where: eq(scans.userId, user.id),
        columns: {
          id: true,
          scanName: true,
          imageUrl: true,
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
      })
    : [];

  const scanRecords = scansList.map((s) => {
    const eczema = Math.min(
      100,
      Math.max(0, Math.round((s.hydration + s.acne + s.texture) / 3))
    );
    return {
      id: s.id,
      scanName: s.scanName,
      imageUrl: s.imageUrl,
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

  const visitsList = await db.query.visitNotes.findMany({
    where: eq(visitNotes.userId, user.id),
    columns: {
      id: true,
      visitDate: true,
      doctorName: true,
      notes: true,
    },
    orderBy: [desc(visitNotes.visitDate)],
  });

  const visitRecords = visitsList.map((v) => ({
    id: v.id,
    visitDateYmd: ymdFromDateOnly(v.visitDate),
    doctorName: v.doctorName,
    notes: v.notes,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-center text-2xl font-bold tracking-tight text-zinc-900">
        Treatment History
      </h1>
      <HistoryView scans={scanRecords} visitNotes={visitRecords} />
    </div>
  );
}
