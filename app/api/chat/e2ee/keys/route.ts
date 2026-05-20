import { NextResponse } from "next/server";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import {
  getUserPublicKeyJwk,
  upsertUserPublicKey,
} from "@/src/lib/chatE2ee/store";

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

  await upsertUserPublicKey(userId, jwk);
  return NextResponse.json({ ok: true });
}
