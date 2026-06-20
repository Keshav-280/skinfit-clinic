import { NextResponse } from "next/server";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { annotatorImages } from "@/src/db/schema";
import { resolveAnnotatorImageSrc } from "@/src/lib/annotatorStorage";
import { assertSafeStoragePath, getStorage } from "@/src/lib/infra";
import { requireAnnotatorAuth } from "@/src/lib/auth/require-annotator-auth";
import { clearAllAnnotatorWork } from "@/src/lib/annotatorParallelService";

const MAX_BYTES = 12 * 1024 * 1024;

type CreateImageInput = {
  fileName: string;
  mimeType: string;
  /** Storage path from presign or server upload, e.g. annotator/uuid.jpg */
  path: string;
};

type AnnotatorImageRow = {
  id: number;
  fileName: string;
  mimeType: string;
  fileUrl: string | null;
  dataUri: string | null;
  sortOrder: number;
};

function toClientImage(row: AnnotatorImageRow) {
  return {
    id: row.id,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sortOrder: row.sortOrder,
    imageUrl: resolveAnnotatorImageSrc(row.fileUrl, row.dataUri) || null,
    fileUrl: row.fileUrl,
    dataUri: row.dataUri,
  };
}

async function selectAllImages() {
  return db
    .select({
      id: annotatorImages.id,
      fileName: annotatorImages.fileName,
      mimeType: annotatorImages.mimeType,
      fileUrl: annotatorImages.fileUrl,
      dataUri: annotatorImages.dataUri,
      sortOrder: annotatorImages.sortOrder,
    })
    .from(annotatorImages)
    .orderBy(asc(annotatorImages.sortOrder), asc(annotatorImages.id));
}

async function deleteStoragePaths(paths: string[]) {
  const storage = getStorage();
  await Promise.all(paths.map((p) => storage.delete(p)));
}

export async function GET(req: Request) {
  const auth = await requireAnnotatorAuth(req);
  if (auth) return auth;
  const rows = await selectAllImages();
  return NextResponse.json({
    success: true,
    images: rows.map(toClientImage),
  });
}

export async function POST(req: Request) {
  const auth = await requireAnnotatorAuth(req);
  if (auth) return auth;

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) {
      return NextResponse.json({ error: "NO_FILES_PROVIDED" }, { status: 400 });
    }
    for (const file of files) {
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: "FILE_TOO_LARGE" }, { status: 413 });
      }
    }

    const last = await db
      .select({ sortOrder: annotatorImages.sortOrder })
      .from(annotatorImages)
      .orderBy(desc(annotatorImages.sortOrder))
      .limit(1);
    let nextSortOrder = (last[0]?.sortOrder ?? -1) + 1;

    const storage = getStorage();
    const inserts: Array<{
      fileName: string;
      mimeType: string;
      fileUrl: string;
      sortOrder: number;
    }> = [];

    for (const file of files) {
      const buf = Buffer.from(await file.arrayBuffer());
      const uploaded = await storage.upload(
        "annotator",
        file.name || "upload.jpg",
        buf,
        file.type || "image/jpeg"
      );
      inserts.push({
        fileName: file.name?.trim() || `image-${nextSortOrder + 1}`,
        mimeType: file.type?.trim() || "image/jpeg",
        fileUrl: uploaded.path,
        sortOrder: nextSortOrder++,
      });
    }

    const created = await db
      .insert(annotatorImages)
      .values(inserts)
      .returning({
        id: annotatorImages.id,
        fileName: annotatorImages.fileName,
        mimeType: annotatorImages.mimeType,
        fileUrl: annotatorImages.fileUrl,
        dataUri: annotatorImages.dataUri,
        sortOrder: annotatorImages.sortOrder,
      });

    return NextResponse.json({
      success: true,
      createdCount: created.length,
      images: created.map(toClientImage),
    });
  }

  const body = (await req.json().catch(() => null)) as { images?: CreateImageInput[] } | null;
  const incoming = body?.images ?? [];
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return NextResponse.json({ error: "NO_IMAGES_PROVIDED" }, { status: 400 });
  }

  for (const img of incoming) {
    const path = img.path?.trim();
    if (!path) {
      return NextResponse.json({ error: "PATH_REQUIRED" }, { status: 400 });
    }
    try {
      assertSafeStoragePath(path);
    } catch {
      return NextResponse.json({ error: "INVALID_PATH" }, { status: 400 });
    }
    if (!path.startsWith("annotator/")) {
      return NextResponse.json({ error: "INVALID_PATH" }, { status: 400 });
    }
  }

  const last = await db
    .select({ sortOrder: annotatorImages.sortOrder })
    .from(annotatorImages)
    .orderBy(desc(annotatorImages.sortOrder))
    .limit(1);
  let nextSortOrder = (last[0]?.sortOrder ?? -1) + 1;

  const inserts = incoming.map((img) => ({
    fileName: img.fileName?.trim() || `image-${nextSortOrder + 1}`,
    mimeType: img.mimeType?.trim() || "image/jpeg",
    fileUrl: img.path.trim(),
    sortOrder: nextSortOrder++,
  }));

  const created = await db
    .insert(annotatorImages)
    .values(inserts)
    .returning({
      id: annotatorImages.id,
      fileName: annotatorImages.fileName,
      mimeType: annotatorImages.mimeType,
      fileUrl: annotatorImages.fileUrl,
      dataUri: annotatorImages.dataUri,
      sortOrder: annotatorImages.sortOrder,
    });

  return NextResponse.json({
    success: true,
    createdCount: created.length,
    images: created.map(toClientImage),
  });
}

export async function DELETE(req: Request) {
  const auth = await requireAnnotatorAuth(req);
  if (auth) return auth;

  const url = new URL(req.url);
  const idRaw = url.searchParams.get("id");

  if (!idRaw) {
    const rows = await db
      .select({ fileUrl: annotatorImages.fileUrl })
      .from(annotatorImages);
    const paths = rows.map((r) => r.fileUrl).filter((p): p is string => Boolean(p?.trim()));
    await deleteStoragePaths(paths);
    await db.delete(annotatorImages);
    await clearAllAnnotatorWork();
    return NextResponse.json({ success: true, deleted: "all" });
  }

  const id = Number.parseInt(idRaw, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  }

  const [row] = await db
    .select({ fileUrl: annotatorImages.fileUrl })
    .from(annotatorImages)
    .where(eq(annotatorImages.id, id))
    .limit(1);
  if (row?.fileUrl?.trim()) {
    await deleteStoragePaths([row.fileUrl]);
  }

  await db.delete(annotatorImages).where(eq(annotatorImages.id, id));
  await db.execute(
    sql`select setval(pg_get_serial_sequence('annotator_images', 'id'), coalesce((select max(id) from annotator_images), 1), true)`
  );
  return NextResponse.json({ success: true, deleted: id });
}
