import { NextResponse } from "next/server";
import { requireAnnotatorAuth } from "@/src/lib/auth/require-annotator-auth";
import { buildMergedAnnotatorExport } from "@/src/lib/annotatorExport";
import {
  listAnnotatorAssignments,
  listAnnotatorImageMeta,
  loadAnnotatorStatesByUserIds,
} from "@/src/lib/annotatorParallelService";
import { annotatorTeamUserIdsFromEnv } from "@/src/lib/annotatorScope";
import { assignmentForUser } from "@/src/lib/annotatorAssignments";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";

export async function POST(req: Request) {
  const auth = await requireAnnotatorAuth(req);
  if (auth) return auth;

  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    imageDimensions?: Record<string, { width: number; height: number }>;
  };

  const images = await listAnnotatorImageMeta();
  const assignments = await listAnnotatorAssignments();

  const userIds =
    assignments.length > 0
      ? assignments.map((a) => a.userId)
      : [...new Set([userId, ...annotatorTeamUserIdsFromEnv()])];

  const statesByUserId = await loadAnnotatorStatesByUserIds(userIds);

  const imageDimensions: Record<number, { width: number; height: number }> = {};
  for (const [key, dim] of Object.entries(body.imageDimensions ?? {})) {
    const idx = Number(key);
    if (
      Number.isFinite(idx) &&
      dim &&
      Number.isFinite(dim.width) &&
      Number.isFinite(dim.height)
    ) {
      imageDimensions[idx] = { width: dim.width, height: dim.height };
    }
  }

  const payload = buildMergedAnnotatorExport({
    images,
    assignments,
    statesByUserId,
    imageDimensions,
  });

  const mine = assignmentForUser(userId, assignments);
  const covered = assignments.reduce(
    (acc, a) => acc + Math.max(0, a.endIndex - a.startIndex + 1),
    0
  );

  return NextResponse.json({
    success: true,
    export: payload,
    summary: {
      imageCount: images.length,
      parallelConfigured: assignments.length > 0,
      annotatorCount: assignments.length,
      imagesCoveredByAssignments: covered,
      yourRange: mine
        ? { startIndex: mine.startIndex, endIndex: mine.endIndex }
        : null,
    },
  });
}
