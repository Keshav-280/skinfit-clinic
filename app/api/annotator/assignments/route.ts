import { NextResponse } from "next/server";
import { requireAnnotatorAuth } from "@/src/lib/auth/require-annotator-auth";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { assignmentForUser } from "@/src/lib/annotatorAssignments";
import { annotatorTeamUserIdsFromEnv } from "@/src/lib/annotatorScope";
import {
  listAnnotatorAssignments,
  rebalanceAnnotatorAssignments,
  resolveAnnotatorUserIds,
} from "@/src/lib/annotatorParallelService";

export async function GET(req: Request) {
  const auth = await requireAnnotatorAuth(req);
  if (auth) return auth;

  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const assignments = await listAnnotatorAssignments();
  const mine = assignmentForUser(userId, assignments);

  return NextResponse.json({
    success: true,
    configured: assignments.length > 0,
    assignment: mine,
    team: assignments,
    envTeamUserIds: annotatorTeamUserIdsFromEnv(),
  });
}

export async function POST(req: Request) {
  const auth = await requireAnnotatorAuth(req);
  if (auth) return auth;

  const body = (await req.json().catch(() => null)) as
    | { userIds?: string[]; emails?: string[]; useEnvTeam?: boolean }
    | null;

  let userIds = body?.userIds;
  let emails = body?.emails;

  if (body?.useEnvTeam) {
    const envIds = annotatorTeamUserIdsFromEnv();
    userIds = [...(userIds ?? []), ...envIds];
  }

  const resolved = await resolveAnnotatorUserIds({
    userIds,
    emails,
  });

  if (resolved.length === 0) {
    return NextResponse.json(
      {
        error: "NO_ANNOTATORS_PROVIDED",
        message:
          "Provide userIds or emails, or set ANNOTATOR_TEAM_USER_IDS in the server environment.",
      },
      { status: 400 }
    );
  }

  try {
    const result = await rebalanceAnnotatorAssignments({
      userIds: resolved,
      emails: [],
    });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const code = err instanceof Error ? err.message : "REBALANCE_FAILED";
    return NextResponse.json({ error: code }, { status: 400 });
  }
}
