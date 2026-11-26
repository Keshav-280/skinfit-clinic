import { requireStaff } from "@/src/lib/auth/requireStaff";
import { NextResponse } from "next/server";
import { runRoboflowSkinAnalysis } from "../../../../src/lib/roboflowSkinAnalysis";

export async function POST(req: Request) {
  const denied = await requireStaff();
  if (denied) return denied;
  try {
    const body = await req.json();
    const base64Image = body.base64Image as string | undefined;

    if (!base64Image || typeof base64Image !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing base64Image in request body" },
        { status: 400 }
      );
    }

    const { annotations, finalScores } =
      await runRoboflowSkinAnalysis(base64Image);

    return NextResponse.json({
      success: true,
      data: {
        scores: {
          acneAndInflammation: finalScores.acneAndInflammation,
          wrinkles: finalScores.wrinkles,
          pigmentation: finalScores.pigmentation,
          hydration: finalScores.hydration,
          overallHealth: finalScores.overallHealth,
        },
        annotations,
        routine: { am: ["Cleanser"], pm: ["Moisturizer"] },
      },
    });
  } catch (error: unknown) {
    console.error("AI analyze error:", error);
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
