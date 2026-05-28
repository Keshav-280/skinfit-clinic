import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "../../../src/db";
import { scans, users } from "../../../src/db/schema";
import {
  invalidateUserHomeCache,
  invalidateUserInsightsCache,
  invalidateUserScanDerivedCaches,
} from "../../../src/lib/infra";
import { runRoboflowSkinAnalysis } from "../../../src/lib/roboflowSkinAnalysis";

/**
 * Runs Roboflow analysis, persists results to Neon, and returns scanId for the dashboard.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const base64Image = body.base64Image as string | undefined;

    if (!base64Image || typeof base64Image !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing base64Image in request body" },
        { status: 400 }
      );
    }

    const { annotations, acneScore, finalScores } =
      await runRoboflowSkinAnalysis(base64Image);

    // Until auth is wired, use the first user (same pattern as /api/scan).
    // Optional: set SCAN_DEFAULT_USER_ID to a real users.id UUID to pin a patient.
    const explicitUserId = process.env.SCAN_DEFAULT_USER_ID?.trim();
    const user = explicitUserId
      ? await db.query.users.findFirst({
          where: eq(users.id, explicitUserId),
          columns: { id: true },
        })
      : await db.query.users.findFirst({ columns: { id: true } });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No user found. Seed the database or set SCAN_DEFAULT_USER_ID to a valid user UUID.",
        },
        { status: 400 }
      );
    }

    const [newScan] = await db
      .insert(scans)
      .values({
        userId: user.id,
        scanName: "AI skin analysis",
        imageUrl: "pending_upload",
        overallScore: acneScore,
        acne: finalScores.acneAndInflammation,
        pigmentation: finalScores.pigmentation,
        wrinkles: finalScores.wrinkles,
        hydration: finalScores.hydration,
        texture: 80,
        scores: finalScores,
        annotations,
      })
      .returning();

    await Promise.all([
      invalidateUserHomeCache(user.id),
      invalidateUserScanDerivedCaches(user.id),
      invalidateUserInsightsCache(user.id),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        scanId: newScan.id,
        scores: finalScores,
        annotations,
        routine: { am: ["Cleanser"], pm: ["Moisturizer"] },
      },
    });
  } catch (error: unknown) {
    console.error("analyze-skin error:", error);
    const errMsg =
      error instanceof Error ? error.message : "Analysis failed.";
    if (errMsg === "Roboflow API failed to return predictions.") {
      return NextResponse.json(
        { success: false, error: errMsg },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}
