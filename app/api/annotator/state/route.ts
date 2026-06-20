import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { annotatorState } from "@/src/db/schema";
import { requireAnnotatorAuth } from "@/src/lib/auth/require-annotator-auth";

const DEFAULT_SCOPE = "default";
type AnnotationShape = {
  id: string;
  imageIndex: number;
  category: string;
  spec: string;
  severity: string;
  color: string;
  type: "path" | "line";
  points: Array<{ x: number; y: number }>;
};

type PerImageByCategoryShape = Record<
  string,
  Record<string, { spec?: string; grade?: string; score?: number }>
>;

export async function GET(req: Request) {
  const auth = await requireAnnotatorAuth(req);
  if (auth) return auth;
  const [row] = await db
    .select({
      id: annotatorState.id,
      scope: annotatorState.scope,
      perImageByCategory: annotatorState.perImageByCategory,
      annotations: annotatorState.annotations,
      currentIndex: annotatorState.currentIndex,
      updatedAt: annotatorState.updatedAt,
    })
    .from(annotatorState)
    .where(eq(annotatorState.scope, DEFAULT_SCOPE))
    .limit(1);

  return NextResponse.json({
    success: true,
    state: row ?? null,
  });
}

export async function PUT(req: Request) {
  const auth = await requireAnnotatorAuth(req);
  if (auth) return auth;

  const body = (await req.json().catch(() => null)) as
    | {
        perImageByCategory?: PerImageByCategoryShape;
        annotations?: AnnotationShape[];
        currentIndex?: number;
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "INVALID_JSON_BODY" }, { status: 400 });
  }

  const data: Pick<
    typeof annotatorState.$inferInsert,
    "perImageByCategory" | "annotations" | "currentIndex" | "updatedAt"
  > = {
    perImageByCategory: body.perImageByCategory ?? {},
    annotations: body.annotations ?? [],
    currentIndex: Math.max(0, Math.floor(body.currentIndex ?? 0)),
    updatedAt: new Date(),
  };

  const [existing] = await db
    .select({ id: annotatorState.id })
    .from(annotatorState)
    .where(eq(annotatorState.scope, DEFAULT_SCOPE))
    .limit(1);

  if (existing) {
    await db.update(annotatorState).set(data).where(eq(annotatorState.id, existing.id));
  } else {
    await db.insert(annotatorState).values({
      scope: DEFAULT_SCOPE,
      ...data,
    });
  }

  return NextResponse.json({ success: true });
}
