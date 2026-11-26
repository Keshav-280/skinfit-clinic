import { and, eq, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { placeholderEmailForPhone } from "@/src/lib/auth/placeholderEmail";
import {
  cleanPhone,
  INTAKE_FORM_VERSION,
  profileFromIntake,
  type IntakeAnswers,
} from "@/src/lib/intake/form";

/**
 * Created on first use (idempotent DDL) so no manual prod migration is needed. Medical answers
 * live in their own table (removed with the account through the cascade), never on `users`.
 * `verified` = the account owner was signed in, or the account was created by this submission.
 */
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS clinic_intake_forms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    form_version integer NOT NULL,
    answers jsonb NOT NULL,
    verified boolean NOT NULL,
    entered_by_staff uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS clinic_intake_forms_user_idx
    ON clinic_intake_forms (user_id, created_at DESC)`,
];

let ready: Promise<void> | null = null;

export function ensureIntakeSchema(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      for (const statement of STATEMENTS) {
        await db.execute(sql.raw(statement));
      }
    })().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}

export type IntakeUser = { id: string; email: string; name: string; role: string };

export type SaveIntakeResult =
  /** A new account: sign this person in (unless staff typed it). */
  | { kind: "created"; user: IntakeUser }
  /** The signed-in patient's own account. */
  | { kind: "updated"; user: IntakeUser }
  /** The number or email already has an account and nobody proved they own it: form kept, no sign-in. */
  | { kind: "existing"; user: IntakeUser };

const userColumns = {
  id: users.id,
  email: users.email,
  name: users.name,
  role: users.role,
  phone: users.phone,
  phoneCountryCode: users.phoneCountryCode,
};

/**
 * Saves one submitted form. Typing someone's phone number or email must never open their account,
 * so an existing account is only updated when its own owner is already signed in.
 * `answers` must already be sanitised and free of errors.
 */
export async function saveIntake(opts: {
  answers: IntakeAnswers;
  sessionUserId: string | null;
  staffUserId: string | null;
}): Promise<SaveIntakeResult> {
  const a = opts.answers;
  const countryCode = a.phoneCountryCode;
  const phone = cleanPhone(countryCode, a.phone);
  if (!phone) throw new Error("intake saved without a valid phone");
  const stored: IntakeAnswers = { ...a, phone };
  const profile = profileFromIntake(stored);
  await ensureIntakeSchema();

  return db.transaction(async (tx) => {
    // Two taps on Submit, or two phones with the same number, must not make two accounts.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`intake:${countryCode}${phone}`}))`);

    const keep = async (userId: string, verified: boolean) => {
      await tx.execute(
        sql`INSERT INTO clinic_intake_forms (user_id, form_version, answers, verified, entered_by_staff)
            VALUES (${userId}, ${INTAKE_FORM_VERSION}, ${JSON.stringify(stored)}::jsonb, ${verified}, ${opts.staffUserId})`
      );
    };

    const [session] = opts.sessionUserId
      ? await tx.select(userColumns).from(users).where(eq(users.id, opts.sessionUserId)).limit(1)
      : [];
    // On a shared device the signed-in person may be someone else: the details must match.
    const ownForm =
      session?.role === "patient" &&
      (session.phone?.trim()
        ? session.phone === phone && session.phoneCountryCode === countryCode
        : stored.email !== "" && session.email.toLowerCase() === stored.email);

    if (session && ownForm) {
      await tx
        .update(users)
        .set({
          age: profile.age,
          gender: profile.gender,
          ...(profile.skinType ? { skinType: profile.skinType } : {}),
          primaryConcern: profile.primaryConcern,
          concerns: profile.concerns,
          priorTreatment: profile.priorTreatment,
          treatmentHistoryText: profile.treatmentHistoryText,
          baselineSunExposure: profile.baselineSunExposure,
          baselineHydration: profile.baselineHydration,
          phone,
          phoneCountryCode: countryCode,
          onboardingComplete: true,
          onboardingCompletedAt: sql`COALESCE(${users.onboardingCompletedAt}, now())`,
        })
        .where(eq(users.id, session.id));
      await keep(session.id, true);
      return { kind: "updated" as const, user: session };
    }

    const [byPhone] = await tx
      .select(userColumns)
      .from(users)
      .where(and(eq(users.phoneCountryCode, countryCode), eq(users.phone, phone), eq(users.role, "patient")))
      .limit(1);
    const [byEmail] = stored.email
      ? await tx.select(userColumns).from(users).where(sql`lower(${users.email}) = ${stored.email}`).limit(1)
      : [];
    const existing = byPhone ?? (byEmail?.role === "patient" ? byEmail : undefined);
    if (existing) {
      await keep(existing.id, false);
      return { kind: "existing" as const, user: existing };
    }

    const [created] = await tx
      .insert(users)
      .values({
        name: stored.name,
        // A staff member's address (or none given): use the phone placeholder instead.
        email: stored.email && !byEmail ? stored.email : placeholderEmailForPhone(countryCode, phone),
        phoneCountryCode: countryCode,
        phone,
        passwordHash: null,
        role: "patient",
        ...profile,
        onboardingComplete: true,
        onboardingCompletedAt: new Date(),
      })
      .returning(userColumns);
    if (!created) throw new Error("intake account was not created");
    await keep(created.id, true);
    return { kind: "created" as const, user: created };
  });
}

export async function hasIntakeForm(userId: string): Promise<boolean> {
  await ensureIntakeSchema();
  const res = await db.execute(
    sql`SELECT 1 FROM clinic_intake_forms WHERE user_id = ${userId} LIMIT 1`
  );
  return res.rows.length > 0;
}

export type StoredIntake = {
  id: string;
  answers: unknown;
  verified: boolean;
  enteredByStaff: boolean;
  createdAt: string;
};

/** Newest first. Staff-only data: callers must check the staff session. */
export async function listIntakeForms(userId: string): Promise<StoredIntake[]> {
  await ensureIntakeSchema();
  const res = await db.execute(
    sql`SELECT id, answers, verified, entered_by_staff, created_at FROM clinic_intake_forms
        WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 10`
  );
  return res.rows.map((r) => ({
    id: String(r.id),
    answers: r.answers,
    verified: r.verified === true,
    enteredByStaff: r.entered_by_staff != null,
    createdAt: new Date(r.created_at as string).toISOString(),
  }));
}
