import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { eq } from "drizzle-orm";
import { db } from "../../../src/db";
import { scans, skinScans, users } from "../../../src/db/schema";
import { getSessionUserId } from "../../../src/lib/auth/get-session";
import { buildDummyAiSummary } from "../../../src/lib/dummyScanSummary";

const LABELS = ["Wrinkle", "Acne", "Pigmentation", "Texture Irregularity"];

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateDetectedRegions() {
  const count = randomInt(4, 7);
  return Array.from({ length: count }, () => ({
    issue: LABELS[randomInt(0, LABELS.length - 1)] as string,
    coordinates: {
      x: randomInt(35, 65),
      y: randomInt(25, 75),
    },
  }));
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");
    const scanName = (formData.get("scanName") as string) || "Untitled Scan";

    if (!image || !(image instanceof File)) {
      return NextResponse.json(
        { success: false, error: "No image file provided" },
        { status: 400 }
      );
    }

    // Convert uploaded file to Base64 Data URI
    const arrayBuffer = await image.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = image.type || "image/jpeg";
    const imageDataUri = `data:${mimeType};base64,${base64}`;

    // Simulate 2.5 second AI processing delay
    await new Promise((resolve) => setTimeout(resolve, 2500));

    const metrics = {
      acne: randomInt(0, 100),
      pigmentation: randomInt(0, 100),
      wrinkles: randomInt(0, 100),
      hydration: randomInt(0, 100),
      texture: randomInt(0, 100),
      overall_score: randomInt(50, 98),
    };

    const eczemaScore = Math.min(
      100,
      Math.max(
        0,
        Math.round(
          (metrics.hydration + metrics.acne + metrics.texture) / 3
        )
      )
    );

    const detected_regions = generateDetectedRegions();

    // Prefer OpenAI when configured; otherwise (or on failure) use dummy templates.
    let aiSummary = buildDummyAiSummary(metrics);
    const openaiKey = process.env.OPENAI_API_KEY?.trim();
    if (openaiKey) {
      try {
        const openai = new OpenAI({ apiKey: openaiKey });
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are an empathetic, professional dermatological AI assistant. Write exactly ONE short sentence summarizing the patient's skin health based on these metrics and offering a gentle, non-medical recommendation. CRITICAL SCORING RULE: For ALL metrics (including Acne, Pigmentation, and Wrinkles), a HIGHER number is BETTER. A score of 100 means perfect/clear skin, and a score of 0 means severe issues. For example, a high Acne score means the user has very clear skin with almost no acne. Do not use clinical jargon.",
            },
            {
              role: "user",
              content: `Skin metrics: acne ${metrics.acne}, pigmentation ${metrics.pigmentation}, wrinkles ${metrics.wrinkles}, hydration ${metrics.hydration}, texture ${metrics.texture}, overall score ${metrics.overall_score}.`,
            },
          ],
          max_tokens: 80,
        });
        const text = completion.choices[0]?.message?.content?.trim();
        if (text) aiSummary = text;
      } catch (err) {
        console.error("OpenAI summary error:", err);
      }
    }

    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Sign in to save a skin scan." },
        { status: 401 }
      );
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 400 }
      );
    }

    const analysisResults = {
      acne: metrics.acne,
      wrinkles: metrics.wrinkles,
      texture: metrics.texture,
      pigmentation: metrics.pigmentation,
      hydration: metrics.hydration,
      eczema: eczemaScore,
    };

    // Insert scan into database
    const [inserted] = await db
      .insert(scans)
      .values({
        userId: user.id,
        scanName: scanName.trim() || null,
        imageUrl: imageDataUri,
        overallScore: metrics.overall_score,
        acne: metrics.acne,
        pigmentation: metrics.pigmentation,
        wrinkles: metrics.wrinkles,
        hydration: metrics.hydration,
        texture: metrics.texture,
        aiSummary: aiSummary || null,
        annotations: detected_regions,
      })
      .returning();

    await db.insert(skinScans).values({
      userId: user.id,
      originalImageUrl: imageDataUri,
      annotatedImageUrl: imageDataUri,
      skinScore: metrics.overall_score,
      analysisResults,
    });

    return NextResponse.json({
      success: true,
      data: {
        metrics,
        detected_regions,
        ai_summary: aiSummary,
        id: inserted?.id,
        userName: user.name,
        scanDate:
          inserted?.createdAt?.toISOString?.() ?? new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Scan API error:", error);
    return NextResponse.json(
      { success: false, error: "Scan failed" },
      { status: 500 }
    );
  }
}
