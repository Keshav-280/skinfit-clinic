import { requireStaff } from "@/src/lib/auth/requireStaff";
import { NextResponse } from "next/server";
import { db } from "../../../../src/db";
import { users, scans } from "../../../../src/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  const denied = await requireStaff();
  if (denied) return denied;
  try {
    const patients = await db.query.users.findMany({
      where: eq(users.role, "patient"),
      columns: { id: true, name: true, email: true },
    });

    const allScans = await db.query.scans.findMany({
      columns: {
        userId: true,
        overallScore: true,
        acne: true,
        pigmentation: true,
        hydration: true,
        aiSummary: true,
        createdAt: true,
      },
      orderBy: [desc(scans.createdAt)],
    });

    const latestScanByUser = new Map<
      string,
      {
        overall_score: number;
        acne: number;
        pigmentation: number;
        hydration: number;
        ai_summary: string | null;
        created_at: Date;
      }
    >();
    for (const scan of allScans) {
      if (!latestScanByUser.has(scan.userId)) {
        latestScanByUser.set(scan.userId, {
          overall_score: scan.overallScore,
          acne: scan.acne,
          pigmentation: scan.pigmentation,
          hydration: scan.hydration,
          ai_summary: scan.aiSummary ?? null,
          created_at: scan.createdAt,
        });
      }
    }

    const result = patients.map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      latest_scan: latestScanByUser.get(p.id) ?? null,
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error("Clinic patients API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch patients" },
      { status: 500 }
    );
  }
}
