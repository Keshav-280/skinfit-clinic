import { createHash, randomInt, timingSafeEqual } from "node:crypto";
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

type StoredFamilyLinkOtp = {
  codeHash: string;
  inviterUserId: string;
  sentAt: number;
  attempts: number;
};

const memoryOtp = new Map<
  string,
  { record: StoredFamilyLinkOtp; expiresAt: number }
>();

function otpCacheKey(email: string): string {
  return `family-link:otp:${email}`;
}

function hashOtp(email: string, code: string): string {
  const pepper = getSessionSecret() || "dev-family-link-otp-pepper";
  return createHash("sha256")
    .update(`${email}:${code}:${pepper}`)
    .digest("hex");
}

function generateOtpCode(): string {
  return String(randomInt(100_000, 1_000_000));
}

async function readOtp(email: string): Promise<StoredFamilyLinkOtp | null> {
  const key = otpCacheKey(email);
  try {
    const fromRedis = await getCache().get<StoredFamilyLinkOtp>(key);
    if (fromRedis) return fromRedis;
  } catch {
    /* */
  }
  const mem = memoryOtp.get(key);
  if (!mem) return null;
  if (Date.now() > mem.expiresAt) {
    memoryOtp.delete(key);
    return null;
  }
  return mem.record;
}

async function writeOtp(email: string, record: StoredFamilyLinkOtp): Promise<void> {
  const key = otpCacheKey(email);
  memoryOtp.set(key, {
    record,
    expiresAt: Date.now() + OTP_TTL_SECONDS * 1000,
  });
  try {
    await getCache().set(key, record, OTP_TTL_SECONDS);
  } catch {
    /* */
  }
}

async function deleteOtp(email: string): Promise<void> {
  memoryOtp.delete(otpCacheKey(email));
  try {
    await getCache().del(otpCacheKey(email));
  } catch {
    /* */
  }
}

export function isFamilyLinkOtpRequired(): boolean {
  if (process.env.FAMILY_LINK_OTP_DISABLED === "true") return false;
  return isSmtpConfigured();
}

export async function sendFamilyLinkOtp(args: {
  inviterUserId: string;
  inviterName: string;
  inviteeEmail: string;
}): Promise<
  | { ok: true; message: string; cooldownSeconds: number }
  | { ok: false; message: string; retryAfterSeconds?: number }
> {
  const email = normalizeSignupEmail(args.inviteeEmail);
  if (!email) {
    return { ok: false, message: "Enter a valid email address." };
  }

  const existing = await readOtp(email);
  if (existing) {
    const elapsed = Math.floor((Date.now() - existing.sentAt) / 1000);
    if (elapsed < OTP_RESEND_COOLDOWN_SECONDS) {
      return {
        ok: false,
        message: `Please wait before requesting another code.`,
        retryAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS - elapsed,
      };
    }
  }

  const code = generateOtpCode();
  const record: StoredFamilyLinkOtp = {
    codeHash: hashOtp(email, code),
    inviterUserId: args.inviterUserId,
    sentAt: Date.now(),
    attempts: 0,
  };
  await writeOtp(email, record);

  if (isFamilyLinkOtpRequired()) {
    await sendSmtpMessage({
      to: email,
      subject: "SkinFit - family card link verification",
      text: `${args.inviterName} wants to add you to their SkinFit family card.\n\nYour verification code is: ${code}\n\nThis code expires in 10 minutes.`,
      html: `<p><strong>${args.inviterName}</strong> wants to add you to their SkinFit family card.</p><p>Your verification code is: <strong>${code}</strong></p><p>This code expires in 10 minutes.</p>`,
    });
    return {
      ok: true,
      message: `Verification code sent to ${email}.`,
      cooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS,
    };
  }

  return {
    ok: true,
    message: `Dev mode: use code ${code} (SMTP not configured).`,
    cooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS,
  };
}

export async function verifyFamilyLinkOtp(args: {
  inviterUserId: string;
  inviteeEmail: string;
  code: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const email = normalizeSignupEmail(args.inviteeEmail);
  if (!email) {
    return { ok: false, message: "Enter a valid email address." };
  }

  const record = await readOtp(email);
  if (!record) {
    return { ok: false, message: "Code expired or not sent. Request a new one." };
  }

  if (record.inviterUserId !== args.inviterUserId) {
    return { ok: false, message: "This code was issued for a different request." };
  }

  if (record.attempts >= OTP_MAX_VERIFY_ATTEMPTS) {
    await deleteOtp(email);
    return { ok: false, message: "Too many attempts. Request a new code." };
  }

  const hash = hashOtp(email, args.code.trim());
  const valid = timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(record.codeHash)
  );

  if (!valid) {
    record.attempts += 1;
    await writeOtp(email, record);
    return { ok: false, message: "Incorrect code. Try again." };
  }

  await deleteOtp(email);
  return { ok: true };
}
