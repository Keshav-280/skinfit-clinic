import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/src/db/client";
import {
  chatThreads,
  doctorPatientCare,
  users,
} from "@/src/db/schema";

export type DoctorPatientCareRow = typeof doctorPatientCare.$inferSelect;

export function getDoctorRegistrationSecret(): string | null {
  const raw =
    process.env.DOCTOR_REGISTRATION_SECRET_KEY?.trim() ||
    process.env.DOCTOR_SIGNUP_SECRET_KEY?.trim();
  return raw && raw.length > 0 ? raw : null;
}

/** Ensures a doctor-patient care row exists; optionally sets the patient's assigned doctor. */
export async function linkDoctorPatientCare(
  doctorId: string,
  patientId: string,
  opts?: { setAssigned?: boolean }
): Promise<DoctorPatientCareRow> {
  const [existing] = await db
    .select()
    .from(doctorPatientCare)
    .where(
      and(
        eq(doctorPatientCare.doctorId, doctorId),
        eq(doctorPatientCare.patientId, patientId)
      )
    )
    .limit(1);

  if (existing) {
    if (opts?.setAssigned !== false) {
      await db
        .update(users)
        .set({ assignedDoctorId: doctorId })
        .where(eq(users.id, patientId));
    }
    return existing;
  }

  const [created] = await db
    .insert(doctorPatientCare)
    .values({ doctorId, patientId })
    .returning();

  if (!created) {
    throw new Error("DOCTOR_PATIENT_CARE_CREATE_FAILED");
  }

  if (opts?.setAssigned !== false) {
    await db
      .update(users)
      .set({ assignedDoctorId: doctorId })
      .where(eq(users.id, patientId));
  }

  return created;
}

export async function doctorHasPatientAccess(
  doctorId: string,
  patientId: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: doctorPatientCare.id })
    .from(doctorPatientCare)
    .where(
      and(
        eq(doctorPatientCare.doctorId, doctorId),
        eq(doctorPatientCare.patientId, patientId)
      )
    )
    .limit(1);
  return Boolean(row?.id);
}

export async function assertDoctorPatientAccess(
  doctorId: string,
  patientId: string
): Promise<void> {
  const ok = await doctorHasPatientAccess(doctorId, patientId);
  if (!ok) {
    const err = new Error("DOCTOR_PATIENT_FORBIDDEN");
    (err as { code?: string }).code = "FORBIDDEN";
    throw err;
  }
}

export async function getAssignedDoctorIdForPatient(
  patientId: string
): Promise<string | null> {
  const [userRow] = await db
    .select({ assignedDoctorId: users.assignedDoctorId })
    .from(users)
    .where(eq(users.id, patientId))
    .limit(1);
  if (userRow?.assignedDoctorId) return userRow.assignedDoctorId;

  const [care] = await db
    .select({ doctorId: doctorPatientCare.doctorId })
    .from(doctorPatientCare)
    .where(eq(doctorPatientCare.patientId, patientId))
    .orderBy(desc(doctorPatientCare.createdAt))
    .limit(1);
  return care?.doctorId ?? null;
}

export async function listPatientIdsForDoctor(doctorId: string): Promise<string[]> {
  const rows = await db
    .select({ patientId: doctorPatientCare.patientId })
    .from(doctorPatientCare)
    .where(eq(doctorPatientCare.doctorId, doctorId));
  return rows.map((r) => r.patientId);
}

/** Staff accounts linked to a patient via doctor_patient_care (isolation boundary). */
export async function listDoctorIdsForPatient(patientId: string): Promise<string[]> {
  const rows = await db
    .select({ doctorId: doctorPatientCare.doctorId })
    .from(doctorPatientCare)
    .where(eq(doctorPatientCare.patientId, patientId));
  return rows.map((r) => r.doctorId);
}

export async function getDoctorPatientCareRow(
  doctorId: string,
  patientId: string
): Promise<DoctorPatientCareRow | null> {
  const [row] = await db
    .select()
    .from(doctorPatientCare)
    .where(
      and(
        eq(doctorPatientCare.doctorId, doctorId),
        eq(doctorPatientCare.patientId, patientId)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function ensureDoctorPatientChatThread(
  patientId: string,
  doctorId: string
): Promise<string> {
  await linkDoctorPatientCare(doctorId, patientId, { setAssigned: false });

  const [existing] = await db
    .select({ id: chatThreads.id })
    .from(chatThreads)
    .where(
      and(
        eq(chatThreads.userId, patientId),
        eq(chatThreads.assistantId, "doctor"),
        eq(chatThreads.doctorId, doctorId)
      )
    )
    .limit(1);

  if (existing?.id) return existing.id;

  const orphans = await db
    .select({ id: chatThreads.id })
    .from(chatThreads)
    .where(
      and(
        eq(chatThreads.userId, patientId),
        eq(chatThreads.assistantId, "doctor"),
        isNull(chatThreads.doctorId)
      )
    );

  if (orphans.length === 1) {
    const [adopted] = await db
      .update(chatThreads)
      .set({ doctorId })
      .where(eq(chatThreads.id, orphans[0]!.id))
      .returning({ id: chatThreads.id });
    if (adopted?.id) return adopted.id;
  }

  const [created] = await db
    .insert(chatThreads)
    .values({
      userId: patientId,
      assistantId: "doctor",
      doctorId,
    })
    .returning({ id: chatThreads.id });

  if (!created?.id) throw new Error("THREAD_CREATE_FAILED");
  return created.id;
}

/** Any staff account that can appear in patient doctor chat. */
export async function resolveRegisteredStaffUserId(
  userId: string | null | undefined
): Promise<string | null> {
  const id = typeof userId === "string" ? userId.trim() : "";
  if (!id) return null;
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.id, id),
        or(eq(users.role, "doctor"), eq(users.role, "admin"))
      )
    )
    .limit(1);
  return row?.id ?? null;
}

export async function listRegisteredClinicDoctors(): Promise<
  {
    id: string;
    name: string;
    email: string | null;
    photoUrl: string | null;
  }[]
> {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      profilePhotoUrl: users.profilePhotoUrl,
    })
    .from(users)
    .where(or(eq(users.role, "doctor"), eq(users.role, "admin")))
    .orderBy(asc(users.name));

  return rows.map((r) => ({
    id: r.id,
    name: (r.name ?? "").trim() || "Doctor",
    email: r.email,
    photoUrl: r.profilePhotoUrl ?? null,
  }));
}

/** Doctor for a patient chat thread: explicit id, assigned, or first registered doctor. */
export async function resolveDoctorIdForPatientChat(
  patientId: string,
  explicitDoctorId?: string | null
): Promise<string | null> {
  const explicit = await resolveRegisteredStaffUserId(explicitDoctorId);
  if (explicit) return explicit;

  const assigned = await getAssignedDoctorIdForPatient(patientId);
  if (assigned) {
    const ok = await resolveRegisteredStaffUserId(assigned);
    if (ok) return ok;
  }

  const doctors = await listRegisteredClinicDoctors();
  return doctors[0]?.id ?? null;
}

/** Patient ids visible in a doctor's roster (care table only). */
export async function filterPatientIdsInDoctorCare(
  doctorId: string,
  patientIds: string[]
): Promise<string[]> {
  if (patientIds.length === 0) return [];
  const rows = await db
    .select({ patientId: doctorPatientCare.patientId })
    .from(doctorPatientCare)
    .where(
      and(
        eq(doctorPatientCare.doctorId, doctorId),
        inArray(doctorPatientCare.patientId, patientIds)
      )
    );
  return rows.map((r) => r.patientId);
}
