import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ChevronLeft } from "lucide-react";
import { VisitDetailView } from "@/components/dashboard/VisitDetailView";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageSection";
import { db } from "@/src/db";
import { visitNotes } from "@/src/db/schema";
import { getSessionUserId } from "@/src/lib/auth/get-session";
import { mapVisitNoteRow } from "@/src/lib/patientVisit";
import { patientGlassShell } from "@/src/lib/patientDashboardTheme";

export default async function VisitDetailPage({
  params,
}: {
  params: Promise<{ visitId: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const { visitId } = await params;
  const row = await db.query.visitNotes.findFirst({
    where: and(eq(visitNotes.id, visitId), eq(visitNotes.userId, userId)),
  });
  if (!row) notFound();

  const visit = mapVisitNoteRow(row);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-1 pb-10 sm:px-0">
      <DashboardPageHeader title="Visit details" />
      <div className={`${patientGlassShell} p-5 md:p-6`}>
        <Link
          href="/dashboard/history/visits"
          className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-[#1E1B31] hover:text-[#5B66A1]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          History &amp; notes
        </Link>
        <VisitDetailView visit={visit} />
      </div>
    </div>
  );
}
