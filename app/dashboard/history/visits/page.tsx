import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { ChevronLeft } from "lucide-react";
import { VisitHistoryList } from "@/components/dashboard/VisitHistoryList";
import {
  DashboardPageHeader,
  DashboardPageSection,
} from "@/components/dashboard/DashboardPageSection";
import { db } from "@/src/db";
import { visitNotes } from "@/src/db/schema";
import { getSessionUserId } from "@/src/lib/auth/get-session";
import { ymdFromDateOnly } from "@/src/lib/date-only";

export default async function VisitsListPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const rows = await db.query.visitNotes.findMany({
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

  const visits = rows.map((v) => ({
    id: v.id,
    visitDateYmd: ymdFromDateOnly(v.visitDate),
    doctorName: v.doctorName,
    notes: v.notes,
    purpose: v.purpose ?? null,
    treatments: v.treatments ?? null,
    responseRating: v.responseRating ?? null,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-1 pb-10 sm:px-0">
      <DashboardPageSection
        title="All visits"
        description="Tap a visit for full notes from your doctor."
      >
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-[#2C3E6B] hover:text-[#3d5080]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Back to Monitor
        </Link>
        <VisitHistoryList visits={visits} />
      </DashboardPageSection>
    </div>
  );
}
