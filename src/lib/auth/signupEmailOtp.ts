import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { getCache } from "@/src/lib/infra";
import {
  isSmtpConfigured,
  sendSmtpMessage,
} from "@/src/lib/email/smtpMail";
import { getSessionSecret } from "@/src/lib/auth/session-secret";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_TTL_SECONDS = 600;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_MAX_VERIFY_ATTEMPTS = 5;

type StoredSignupOtp = {
  codeHash: string;
  sentAt: number;
  attempts: number;
};

/** In-memory fallback when Redis is unavailable (local dev). */
const memoryOtp = new Map<string, { record: StoredSignupOtp; expiresAt: number }>();

export function normalizeSignupEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (!email || !EMAIL_REGEX.test(email)) return null;
  return email;
}

/** OTP required when SMTP is configured (Gmail) unless explicitly disabled. */
export function isSignupEmailOtpRequired(): boolean {
  if (process.env.SIGNUP_EMAIL_OTP_DISABLED === "true") return false;
  return isSmtpConfigured();
}

function otpCacheKey(email: string): string {
  return `signup:otp:${email}`;
}

function hashSignupOtp(email: string, code: string): string {
  const pepper = getSessionSecret() || "dev-signup-otp-pepper";
  return createHash("sha256")
    .update(`${email}:${code}:${pepper}`)
    .digest("hex");
}

function generateOtpCode(): string {
  return String(randomInt(100_000, 1_000_000));
}

async function readOtp(email: string): Promise<StoredSignupOtp | null> {
  const key = otpCacheKey(email);
  try {
    const fromRedis = await getCache().get<StoredSignupOtp>(key);
    if (fromRedis) return fromRedis;
  } catch {
    /* fall through */
  }

  const mem = memoryOtp.get(key);
  if (!mem) return null;
  if (Date.now() > mem.expiresAt) {
    memoryOtp.delete(key);
    return null;
  }
  return mem.record;
}

async function writeOtp(email: string, record: StoredSignupOtp): Promise<void> {
  const key = otpCacheKey(email);
  memoryOtp.set(key, {
    record,
    expiresAt: Date.now() + OTP_TTL_SECONDS * 1000,
  });
  try {
    await getCache().set(key, record, OTP_TTL_SECONDS);
  } catch {
    /* memory store already set */
  }
}

async function deleteOtp(email: string): Promise<void> {
  const key = otpCacheKey(email);
  memoryOtp.delete(key);
  try {
    await getCache().del(key);
  } catch {
    /* noop */
  }
}

export async function isSignupEmailAvailable(email: string): Promise<boolean> {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return !existing;
}

export type SendSignupOtpResult =
  | { ok: true; cooldownSeconds: number }
  | {
      ok: false;
      code:
        | "INVALID_EMAIL"
        | "EMAIL_TAKEN"
        | "SMTP_NOT_CONFIGURED"
        | "COOLDOWN"
        | "SEND_FAILED";
      message: string;
      retryAfterSeconds?: number;
    };

export async function sendSignupEmailOtp(rawEmail: string): Promise<SendSignupOtpResult> {
  const email = normalizeSignupEmail(rawEmail);
  if (!email) {
    return {
      ok: false,
      code: "INVALID_EMAIL",
      message: "Please enter a valid email address.",
    };
  }

  if (!(await isSignupEmailAvailable(email))) {
    return {
      ok: false,
      code: "EMAIL_TAKEN",
      message: "An account with this email already exists. Try signing in.",
    };
  }

  if (!isSmtpConfigured()) {
    return {
      ok: false,
      code: "SMTP_NOT_CONFIGURED",
      message:
        "Email verification is not configured on this server. Contact support.",
    };
  }

  const existing = await readOtp(email);
  if (existing) {
    const elapsed = Math.floor((Date.now() - existing.sentAt) / 1000);
    const wait = OTP_RESEND_COOLDOWN_SECONDS - elapsed;
    if (wait > 0) {
      return {
        ok: false,
        code: "COOLDOWN",
        message: `Wait ${wait}s before requesting a new code.`,
        retryAfterSeconds: wait,
      };
    }
  }

  const code = generateOtpCode();
  const record: StoredSignupOtp = {
    codeHash: hashSignupOtp(email, code),
    sentAt: Date.now(),
    attempts: 0,
  };
  await writeOtp(email, record);

  const subject = `${code} is your SkinFit verification code`;
  const text = `Your SkinFit Wellness verification code is ${code}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:420px;margin:0 auto;padding:24px">
      <p style="font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#5B66A1;margin:0 0 8px">
        SkinFit Wellness
      </p>
      <h1 style="font-size:22px;color:#242A5F;margin:0 0 12px">Verify your email</h1>
      <p style="font-size:15px;line-height:1.5;color:#52525b;margin:0 0 20px">
        Enter this code to finish creating your account:
      </p>
      <p style="font-size:32px;font-weight:800;letter-spacing:0.35em;color:#1E1B31;margin:0 0 20px">${code}</p>
      <p style="font-size:13px;line-height:1.5;color:#71717a;margin:0">
        Expires in 10 minutes. If you didn't request this, ignore this email.
      </p>
    </div>`;

  try {
    await sendSmtpMessage({
      to: email,
      subject,
      text,
      html,
    });
  } catch (e) {
    console.error("sendSignupEmailOtp", e);
    await deleteOtp(email);
    return {
      ok: false,
      code: "SEND_FAILED",
      message: "Could not send verification email. Try again in a moment.",
    };
  }

  if (process.env.NODE_ENV !== "production") {
    console.info(`[signup-otp] ${email} → ${code}`);
  }

  return { ok: true, cooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS };
}

export type VerifySignupOtpResult =
  | { ok: true }
  | {
      ok: false;
      code: "OTP_REQUIRED" | "OTP_INVALID" | "OTP_EXPIRED" | "OTP_TOO_MANY";
      message: string;
    };

export async function verifySignupEmailOtp(
  rawEmail: string,
  rawCode: string
): Promise<VerifySignupOtpResult> {
  if (!isSignupEmailOtpRequired()) {
    return { ok: true };
  }

  const email = normalizeSignupEmail(rawEmail);
  const code = rawCode.trim().replace(/\s/g, "");
  if (!email) {
    return {
      ok: false,
      code: "OTP_INVALID",
      message: "Invalid verification code.",
    };
  }
  if (!/^\d{6}$/.test(code)) {
    return {
      ok: false,
      code: "OTP_INVALID",
      message: "Enter the 6-digit code from your email.",
    };
  }

  const record = await readOtp(email);
  if (!record) {
    return {
      ok: false,
      code: "OTP_EXPIRED",
      message: "Code expired. Request a new verification code.",
    };
  }

  if (record.attempts >= OTP_MAX_VERIFY_ATTEMPTS) {
    await deleteOtp(email);
    return {
      ok: false,
      code: "OTP_TOO_MANY",
      message: "Too many attempts. Request a new verification code.",
    };
  }

  const expected = Buffer.from(record.codeHash, "utf8");
  const actual = Buffer.from(hashSignupOtp(email, code), "utf8");
  const match =
    expected.length === actual.length &&
    timingSafeEqual(expected, actual);

  if (!match) {
    record.attempts += 1;
    await writeOtp(email, record);
    return {
      ok: false,
      code: "OTP_INVALID",
      message: "Incorrect code. Check your email and try again.",
    };
  }

  await deleteOtp(email);
  return { ok: true };
}
