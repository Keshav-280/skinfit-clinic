import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ChevronLeft } from "lucide-react";
import { VisitDetailView } from "@/components/dashboard/VisitDetailView";
import { db } from "@/src/db";
import { visitNotes } from "@/src/db/schema";
import { getSessionUserId } from "@/src/lib/auth/get-session";
import { mapVisitNoteRow } from "@/src/lib/patientVisit";

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
    <div className="space-y-6">
      <div className="rounded-[22px] border border-white/70 bg-white/35 px-6 py-5 backdrop-blur-sm">
        <Link
          href="/dashboard/history"
          className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-[#2C3E6B] hover:text-teal-800"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Treatment history
        </Link>
        <h1 className="text-center text-2xl font-extrabold tracking-tight text-[#2C3E6B]">
          Visit details
        </h1>
      </div>
      <div className="rounded-[22px] border border-white/70 bg-white/35 p-5 backdrop-blur-sm md:p-6">
        <VisitDetailView visit={visit} />
      </div>
    </div>
  );
}
