import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/src/db";
import {
  loginEvents,
  preReleaseSignups,
  scans,
  users,
  wellnessCheckins,
} from "@/src/db/schema";

export type OpsPatientRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  signedUpAt: string;
  lastLoginAt: string | null;
  hasScan: boolean;
  scanCount: number;
  lastScanAt: string | null;
  questionnaireDone: boolean;
  questionnaireAt: string | null;
};

export type OpsOverview = {
  totals: {
    signedUp: number;
    loggedIn: number;
    loggedInLast7Days: number;
    tookScan: number;
    filledQuestionnaire: number;
    waitlist: number;
    weeklyCheckins: number;
  };
  patients: OpsPatientRow[];
};

function missingColumn(error: unknown, column: string): boolean {
  const err = error as { code?: string; message?: string };
  return (
    err.code === "42703" ||
    (typeof err.message === "string" &&
      err.message.toLowerCase().includes(column.toLowerCase()))
  );
}

function iso(d: Date | null | undefined): string | null {
  return d instanceof Date ? d.toISOString() : null;
}

export async function loadOpsOverview(): Promise<OpsOverview> {
  type PatientSelect = {
    id: string;
    name: string;
    email: string;
    phoneCountryCode: string;
    phone: string | null;
    createdAt: Date;
    lastLoginAt: Date | null;
    primaryConcern: string | null;
    onboardingCompletedAt: Date | null;
  };

  let patientRows: PatientSelect[] = [];
  try {
    patientRows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phoneCountryCode: users.phoneCountryCode,
        phone: users.phone,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
        primaryConcern: users.primaryConcern,
        onboardingCompletedAt: users.onboardingCompletedAt,
      })
      .from(users)
      .where(eq(users.role, "patient"))
      .orderBy(desc(users.createdAt));
  } catch (error) {
    if (!missingColumn(error, "last_login_at")) throw error;
    const fallback = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phoneCountryCode: users.phoneCountryCode,
        phone: users.phone,
        createdAt: users.createdAt,
        primaryConcern: users.primaryConcern,
        onboardingCompletedAt: users.onboardingCompletedAt,
      })
      .from(users)
      .where(eq(users.role, "patient"))
      .orderBy(desc(users.createdAt));
    patientRows = fallback.map((row) => ({ ...row, lastLoginAt: null }));
  }

  const [scanRows, waitlistRows, checkinRows] = await Promise.all([
    db
      .select({
        userId: scans.userId,
        scanCount: sql<number>`count(*)::int`,
        lastScanAt: sql<Date>`max(${scans.createdAt})`,
      })
      .from(scans)
      .groupBy(scans.userId),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(preReleaseSignups),
    db
      .select({ n: sql<number>`count(distinct ${wellnessCheckins.userId})::int` })
      .from(wellnessCheckins),
  ]);

  const scanByUser = new Map(
    scanRows.map((row) => [
      row.userId,
      {
        scanCount: Number(row.scanCount) || 0,
        lastScanAt: row.lastScanAt ?? null,
      },
    ])
  );

  let loggedInLast7Days = 0;
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [week] = await db
      .select({
        n: sql<number>`count(distinct ${loginEvents.userId})::int`,
      })
      .from(loginEvents)
      .where(sql`${loginEvents.createdAt} >= ${since}`);
    loggedInLast7Days = Number(week?.n) || 0;
  } catch (error) {
    if (!missingColumn(error, "login_events")) {
      console.warn("[ops] login_events query skipped", error);
    }
  }

  const patients: OpsPatientRow[] = patientRows.map((row) => {
    const scan = scanByUser.get(row.id);
    const questionnaireDone = Boolean(row.primaryConcern?.trim());
    const phone =
      row.phone?.trim()
        ? `${row.phoneCountryCode} ${row.phone}`.trim()
        : null;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone,
      signedUpAt: row.createdAt.toISOString(),
      lastLoginAt: iso(row.lastLoginAt),
      hasScan: Boolean(scan && scan.scanCount > 0),
      scanCount: scan?.scanCount ?? 0,
      lastScanAt: iso(scan?.lastScanAt ?? null),
      questionnaireDone,
      questionnaireAt: iso(row.onboardingCompletedAt),
    };
  });

  const signedUp = patients.length;
  const loggedIn = patients.filter((p) => p.lastLoginAt).length;
  const tookScan = patients.filter((p) => p.hasScan).length;
  const filledQuestionnaire = patients.filter((p) => p.questionnaireDone).length;

  return {
    totals: {
      signedUp,
      loggedIn,
      loggedInLast7Days,
      tookScan,
      filledQuestionnaire,
      waitlist: Number(waitlistRows[0]?.n) || 0,
      weeklyCheckins: Number(checkinRows[0]?.n) || 0,
    },
    patients,
  };
}
