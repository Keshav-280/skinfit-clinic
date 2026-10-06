import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { getCache } from "@/src/lib/infra";
import { getSessionSecret } from "@/src/lib/auth/session-secret";
import {
  normalizeCountryCode,
  validateNationalPhone,
} from "@/src/lib/auth/phone";
import {
  isCountrySupported,
  isSmsAvailable,
  sendOtpSms,
} from "@/src/lib/sms/sendSms";

const OTP_TTL_SECONDS = 300;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_MAX_VERIFY_ATTEMPTS = 5;
const SENDS_PER_PHONE_PER_HOUR = 5;
const SENDS_PER_IP_PER_HOUR = 20;
const HOUR_SECONDS = 3600;

export type PhoneOtpMode = "login" | "register";

type StoredOtp = { codeHash: string; sentAt: number; attempts: number };

const memoryStore = new Map<string, { value: unknown; expiresAt: number }>();

async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const v = await getCache().get<T>(key);
    if (v != null) return v;
  } catch {
    /* fall through to memory */
  }
  const mem = memoryStore.get(key);
  if (!mem) return null;
  if (Date.now() > mem.expiresAt) {
    memoryStore.delete(key);
    return null;
  }
  return mem.value as T;
}

async function cacheSet(key: string, value: unknown, ttlSeconds: number) {
  memoryStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  try {
    await getCache().set(key, value, ttlSeconds);
  } catch {
    /* memory store already set */
  }
}

async function cacheDel(key: string) {
  memoryStore.delete(key);
  try {
    await getCache().del(key);
  } catch {
    /* noop */
  }
}

async function bumpCounter(key: string, limit: number): Promise<boolean> {
  const n = (await cacheGet<number>(key)) ?? 0;
  if (n >= limit) return false;
  await cacheSet(key, n + 1, HOUR_SECONDS);
  return true;
}

function otpKey(e164: string) {
  return `phone:otp:${e164}`;
}

function hashCode(e164: string, code: string): string {
  const pepper = getSessionSecret() || "dev-phone-otp-pepper";
  return createHash("sha256").update(`phone:${e164}:${code}:${pepper}`).digest("hex");
}

export function parsePhone(rawCountryCode: unknown, rawPhone: unknown) {
  const countryCode = normalizeCountryCode(
    typeof rawCountryCode === "string" ? rawCountryCode : "+91"
  );
  const check = validateNationalPhone(typeof rawPhone === "string" ? rawPhone : "");
  if (!check.ok) return { ok: false as const, message: check.message };
  return {
    ok: true as const,
    countryCode,
    nationalDigits: check.nationalDigits,
    e164: `${countryCode}${check.nationalDigits}`,
  };
}

export async function findPatientsByPhone(countryCode: string, nationalDigits: string) {
  return db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      onboardingComplete: users.onboardingComplete,
    })
    .from(users)
    .where(
      and(
        eq(users.phoneCountryCode, countryCode),
        eq(users.phone, nationalDigits),
        eq(users.role, "patient")
      )
    )
    .limit(2);
}

export type SendPhoneOtpResult =
  | { ok: true; cooldownSeconds: number }
  | {
      ok: false;
      code:
        | "INVALID_PHONE"
        | "USER_NOT_FOUND"
        | "PHONE_TAKEN"
        | "AMBIGUOUS_PHONE"
        | "SMS_NOT_CONFIGURED"
        | "COOLDOWN"
        | "RATE_LIMITED"
        | "SEND_FAILED";
      message: string;
      retryAfterSeconds?: number;
    };

export async function sendPhoneOtp(opts: {
  countryCode: unknown;
  phone: unknown;
  mode: PhoneOtpMode;
  ip: string | null;
}): Promise<SendPhoneOtpResult> {
  const parsed = parsePhone(opts.countryCode, opts.phone);
  if (!parsed.ok) {
    return { ok: false, code: "INVALID_PHONE", message: parsed.message };
  }
  const { countryCode, nationalDigits, e164 } = parsed;

  if (!isSmsAvailable()) {
    return {
      ok: false,
      code: "SMS_NOT_CONFIGURED",
      message: "Phone sign-in is not available right now. Please use email.",
    };
  }

  if (!isCountrySupported(countryCode)) {
    return {
      ok: false,
      code: "INVALID_PHONE",
      message: "Phone sign-in currently supports Indian (+91) numbers only. Please use email.",
    };
  }

  const matches = await findPatientsByPhone(countryCode, nationalDigits);
  if (opts.mode === "login") {
    if (matches.length === 0) {
      return {
        ok: false,
        code: "USER_NOT_FOUND",
        message: "No account found with this number. Sign up to create one.",
      };
    }
    if (matches.length > 1) {
      return {
        ok: false,
        code: "AMBIGUOUS_PHONE",
        message:
          "More than one account uses this number. Sign in with your email, or contact support.",
      };
    }
  } else if (matches.length > 0) {
    return {
      ok: false,
      code: "PHONE_TAKEN",
      message: "An account with this number already exists. Try signing in.",
    };
  }

  const existing = await cacheGet<StoredOtp>(otpKey(e164));
  if (existing) {
    const wait = OTP_RESEND_COOLDOWN_SECONDS - Math.floor((Date.now() - existing.sentAt) / 1000);
    if (wait > 0) {
      return {
        ok: false,
        code: "COOLDOWN",
        message: `Wait ${wait}s before requesting a new code.`,
        retryAfterSeconds: wait,
      };
    }
  }

  const phoneOk = await bumpCounter(`phone:otp:sends:${e164}`, SENDS_PER_PHONE_PER_HOUR);
  const ipOk = opts.ip
    ? await bumpCounter(`phone:otp:sends:ip:${opts.ip}`, SENDS_PER_IP_PER_HOUR)
    : true;
  if (!phoneOk || !ipOk) {
    return {
      ok: false,
      code: "RATE_LIMITED",
      message: "Too many code requests. Please try again in an hour.",
    };
  }

  const code = String(randomInt(100_000, 1_000_000));
  await cacheSet(
    otpKey(e164),
    { codeHash: hashCode(e164, code), sentAt: Date.now(), attempts: 0 } satisfies StoredOtp,
    OTP_TTL_SECONDS
  );

  try {
    await sendOtpSms({ countryCode, nationalDigits, code });
  } catch (e) {
    console.error("sendPhoneOtp", e);
    await cacheDel(otpKey(e164));
    return {
      ok: false,
      code: "SEND_FAILED",
      message: "Could not send the code. Try again in a moment.",
    };
  }

  return { ok: true, cooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS };
}

export type VerifyPhoneOtpResult =
  | { ok: true; countryCode: string; nationalDigits: string }
  | {
      ok: false;
      code: "INVALID_PHONE" | "OTP_INVALID" | "OTP_EXPIRED" | "OTP_TOO_MANY";
      message: string;
    };

export async function verifyPhoneOtp(
  rawCountryCode: unknown,
  rawPhone: unknown,
  rawCode: unknown
): Promise<VerifyPhoneOtpResult> {
  const parsed = parsePhone(rawCountryCode, rawPhone);
  if (!parsed.ok) return { ok: false, code: "INVALID_PHONE", message: parsed.message };

  const code = (typeof rawCode === "string" ? rawCode : "").trim().replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, code: "OTP_INVALID", message: "Enter the 6-digit code we sent you." };
  }

  const key = otpKey(parsed.e164);
  const record = await cacheGet<StoredOtp>(key);
  if (!record) {
    return { ok: false, code: "OTP_EXPIRED", message: "Code expired. Request a new code." };
  }
  if (record.attempts >= OTP_MAX_VERIFY_ATTEMPTS) {
    await cacheDel(key);
    return { ok: false, code: "OTP_TOO_MANY", message: "Too many attempts. Request a new code." };
  }

  const expected = Buffer.from(record.codeHash, "utf8");
  const actual = Buffer.from(hashCode(parsed.e164, code), "utf8");
  const match = expected.length === actual.length && timingSafeEqual(expected, actual);
  if (!match) {
    record.attempts += 1;
    await cacheSet(key, record, OTP_TTL_SECONDS);
    return { ok: false, code: "OTP_INVALID", message: "Incorrect code. Check the message and try again." };
  }

  await cacheDel(key);
  return { ok: true, countryCode: parsed.countryCode, nationalDigits: parsed.nationalDigits };
}
