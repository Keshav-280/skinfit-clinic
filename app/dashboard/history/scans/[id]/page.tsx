import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "../../../../../src/db";
import { scans, users } from "../../../../../src/db/schema";
import { getSessionUserId } from "../../../../../src/lib/auth/get-session";
import { parseScanRegions } from "../../../../../src/lib/parseScanAnnotations";
import { ScanReportPageClient } from "../../../../../components/dashboard/ScanReportPageClient";

export default async function ScanReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idParam } = await params;
  const id = Number.parseInt(idParam, 10);
  if (!Number.isFinite(id) || id < 1) notFound();

  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!user) notFound();

  const row = await db.query.scans.findFirst({
    where: and(eq(scans.id, id), eq(scans.userId, userId)),
    columns: {
      id: true,
      scanName: true,
      imageUrl: true,
      overallScore: true,
      acne: true,
      wrinkles: true,
      hydration: true,
      aiSummary: true,
      annotations: true,
      createdAt: true,
    },
  });

  if (!row) notFound();

  const regions = parseScanRegions(row.annotations);

  return (
    <ScanReportPageClient
      userName={user.name?.trim() || "there"}
      scanTitle={row.scanName}
      imageUrl={row.imageUrl}
      regions={regions}
      metrics={{
        acne: row.acne,
        hydration: row.hydration,
        wrinkles: row.wrinkles,
        overall_score: row.overallScore,
      }}
      aiSummary={row.aiSummary}
      scanDateIso={row.createdAt.toISOString()}
    />
  );
}
