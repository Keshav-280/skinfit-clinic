import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { getCache } from "@/src/lib/infra";
import {
  isSmtpConfigured,
  sendSmtpMessage,
} from "@/src/lib/email/smtpMail";
import { getSessionSecret } from "@/src/lib/auth/session-secret";
import { normalizeSignupEmail } from "@/src/lib/auth/signupEmailOtp";

const OTP_TTL_SECONDS = 600;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_MAX_VERIFY_ATTEMPTS = 5;
const MIN_PASSWORD = 8;

type StoredPasswordResetOtp = {
  codeHash: string;
  sentAt: number;
  attempts: number;
};

const memoryOtp = new Map<
  string,
  { record: StoredPasswordResetOtp; expiresAt: number }
>();

function otpCacheKey(email: string): string {
  return `password-reset:otp:${email}`;
}

function hashPasswordResetOtp(email: string, code: string): string {
  const pepper = getSessionSecret() || "dev-password-reset-pepper";
  return createHash("sha256")
    .update(`password-reset:${email}:${code}:${pepper}`)
    .digest("hex");
}

function generateOtpCode(): string {
  return String(randomInt(100_000, 1_000_000));
}

async function readOtp(email: string): Promise<StoredPasswordResetOtp | null> {
  const key = otpCacheKey(email);
  try {
    const fromRedis = await getCache().get<StoredPasswordResetOtp>(key);
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

async function writeOtp(
  email: string,
  record: StoredPasswordResetOtp
): Promise<void> {
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

async function findPasswordResetUser(email: string) {
  const [user] = await db
    .select({
      id: users.id,
      role: users.role,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return user ?? null;
}

export type SendPasswordResetOtpResult =
  | { ok: true; cooldownSeconds: number }
  | {
      ok: false;
      code: "INVALID_EMAIL" | "SMTP_NOT_CONFIGURED" | "COOLDOWN" | "SEND_FAILED";
      message: string;
      retryAfterSeconds?: number;
    };

/** Always returns a generic success message when email is valid (no account enumeration). */
export async function sendPasswordResetOtp(
  rawEmail: string
): Promise<SendPasswordResetOtpResult> {
  const email = normalizeSignupEmail(rawEmail);
  if (!email) {
    return {
      ok: false,
      code: "INVALID_EMAIL",
      message: "Please enter a valid email address.",
    };
  }

  const user = await findPasswordResetUser(email);
  if (!user || user.role !== "patient" || !user.passwordHash) {
    return { ok: true, cooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS };
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
  const record: StoredPasswordResetOtp = {
    codeHash: hashPasswordResetOtp(email, code),
    sentAt: Date.now(),
    attempts: 0,
  };
  await writeOtp(email, record);

  const smtpReady = isSmtpConfigured();
  if (!smtpReady) {
    if (process.env.NODE_ENV === "production") {
      await deleteOtp(email);
      return {
        ok: false,
        code: "SMTP_NOT_CONFIGURED",
        message:
          "Password reset email is not configured on this server. Contact support.",
      };
    }
    console.info(`[password-reset-otp] (no SMTP) ${email} → ${code}`);
    return { ok: true, cooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS };
  }

  const subject = `${code} is your SkinFit password reset code`;
  const text = `Your SkinFit Wellness password reset code is ${code}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:420px;margin:0 auto;padding:24px">
      <p style="font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#3d5080;margin:0 0 8px">
        SkinFit Wellness
      </p>
      <h1 style="font-size:22px;color:#1E3264;margin:0 0 12px">Reset your password</h1>
      <p style="font-size:15px;line-height:1.5;color:#52525b;margin:0 0 20px">
        Enter this code in the app or website to choose a new password:
      </p>
      <p style="font-size:32px;font-weight:800;letter-spacing:0.35em;color:#2C3E6B;margin:0 0 20px">${code}</p>
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
    console.error("sendPasswordResetOtp", e);
    await deleteOtp(email);
    return {
      ok: false,
      code: "SEND_FAILED",
      message: "Could not send reset email. Try again in a moment.",
    };
  }

  if (process.env.NODE_ENV !== "production") {
    console.info(`[password-reset-otp] ${email} → ${code}`);
  }

  return { ok: true, cooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS };
}

export type ResetPasswordWithOtpResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | "INVALID_EMAIL"
        | "PASSWORD_TOO_SHORT"
        | "OTP_REQUIRED"
        | "OTP_INVALID"
        | "OTP_EXPIRED"
        | "OTP_TOO_MANY"
        | "ACCOUNT_NOT_FOUND"
        | "OAUTH_ACCOUNT";
      message: string;
    };

export async function resetPasswordWithOtp(
  rawEmail: string,
  rawCode: string,
  rawPassword: string
): Promise<ResetPasswordWithOtpResult> {
  const email = normalizeSignupEmail(rawEmail);
  const code = rawCode.trim().replace(/\s/g, "");
  const password = typeof rawPassword === "string" ? rawPassword : "";

  if (!email) {
    return {
      ok: false,
      code: "INVALID_EMAIL",
      message: "Please enter a valid email address.",
    };
  }
  if (!password || password.length < MIN_PASSWORD) {
    return {
      ok: false,
      code: "PASSWORD_TOO_SHORT",
      message: `Password must be at least ${MIN_PASSWORD} characters.`,
    };
  }
  if (!/^\d{6}$/.test(code)) {
    return {
      ok: false,
      code: "OTP_INVALID",
      message: "Enter the 6-digit code from your email.",
    };
  }

  const user = await findPasswordResetUser(email);
  if (!user) {
    return {
      ok: false,
      code: "ACCOUNT_NOT_FOUND",
      message: "We couldn't reset the password for this account.",
    };
  }
  if (!user.passwordHash) {
    return {
      ok: false,
      code: "OAUTH_ACCOUNT",
      message:
        "This account uses social sign-in. Sign in with Google instead.",
    };
  }

  const record = await readOtp(email);
  if (!record) {
    return {
      ok: false,
      code: "OTP_EXPIRED",
      message: "Code expired. Request a new reset code.",
    };
  }

  if (record.attempts >= OTP_MAX_VERIFY_ATTEMPTS) {
    await deleteOtp(email);
    return {
      ok: false,
      code: "OTP_TOO_MANY",
      message: "Too many attempts. Request a new reset code.",
    };
  }

  const expected = Buffer.from(record.codeHash, "utf8");
  const actual = Buffer.from(hashPasswordResetOtp(email, code), "utf8");
  const match =
    expected.length === actual.length && timingSafeEqual(expected, actual);

  if (!match) {
    record.attempts += 1;
    await writeOtp(email, record);
    return {
      ok: false,
      code: "OTP_INVALID",
      message: "Incorrect code. Check your email and try again.",
    };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, user.id));

  await deleteOtp(email);
  return { ok: true };
}
