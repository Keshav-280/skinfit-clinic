import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { resolveStaffUserIdInDb } from "@/src/lib/auth/ensureFallbackDoctor";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import {
  getUserPublicKeyJwk,
  upsertUserPublicKey,
} from "@/src/lib/chatE2ee/store";

function postgresErrorCode(e: unknown): string | undefined {
  if (!e || typeof e !== "object") return undefined;
  const o = e as { code?: string; cause?: { code?: string } };
  return o.code ?? o.cause?.code;
}

function isMissingE2eeKeysTable(e: unknown): boolean {
  const code = postgresErrorCode(e);
  if (code === "42P01") return true;
  const msg =
    e && typeof e === "object" && "message" in e
      ? String((e as { message?: string }).message)
      : "";
  return /chat_user_e2ee_keys/i.test(msg);
}

function parsePublicKeyJwk(raw: unknown): JsonWebKey | null {
  if (!raw || typeof raw !== "object") return null;
  const jwk = raw as JsonWebKey;
  if (jwk.kty !== "RSA" || typeof jwk.n !== "string" || typeof jwk.e !== "string") {
    return null;
  }
  return jwk;
}

async function resolveUserId(req: Request): Promise<string | null> {
  const doctorId = await getDoctorPortalUserId();
  if (doctorId) return doctorId;
  return getSessionUserIdFromRequest(req);
}

export async function GET(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const jwk = await getUserPublicKeyJwk(userId);
  return NextResponse.json({ ok: true, hasKey: Boolean(jwk), publicKeyJwk: jwk });
}

export async function POST(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const jwk = parsePublicKeyJwk(
    body && typeof body === "object"
      ? (body as { publicKeyJwk?: unknown }).publicKeyJwk
      : null
  );
  if (!jwk) {
    return NextResponse.json({ error: "INVALID_PUBLIC_KEY" }, { status: 400 });
  }

  const persistedUserId = await resolveStaffUserIdInDb(userId);
  if (!persistedUserId) {
    return NextResponse.json(
      {
        error: "USER_NOT_IN_DB",
        message:
          "Your account must exist in the database before secure chat keys can be saved.",
      },
      { status: 403 }
    );
  }

  try {
    await upsertUserPublicKey(persistedUserId, jwk);
  } catch (e) {
    if (isMissingE2eeKeysTable(e)) {
      console.error(
        "[chat/e2ee/keys POST] chat_user_e2ee_keys missing — run drizzle/0031_chat_e2ee.sql"
      );
      return NextResponse.json({ error: "E2EE_TABLE_MISSING" }, { status: 503 });
    }
    console.error("[chat/e2ee/keys POST]", e);
    return NextResponse.json({ error: "KEY_REGISTER_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
