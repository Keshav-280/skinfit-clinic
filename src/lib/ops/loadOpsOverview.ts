import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/src/db";
import {
  loginEvents,
  preReleaseSignups,
  scans,
  users,
  wellnessCheckins,
} from "@/src/db/schema";
import { opsIso } from "@/src/lib/ops/opsDates";
import {
  hasReturnedToPortal,
  type OpsOverview,
  type OpsPatientRow,
} from "@/src/lib/ops/opsOverviewShared";

export type { OpsOverview, OpsPatientRow } from "@/src/lib/ops/opsOverviewShared";
export {
  hasReturnedToPortal,
  inferLastSeenAt,
  latestIso,
} from "@/src/lib/ops/opsOverviewShared";

function missingColumn(error: unknown, column: string): boolean {
  const err = error as { code?: string; message?: string };
  return (
    err.code === "42703" ||
    (typeof err.message === "string" &&
      err.message.toLowerCase().includes(column.toLowerCase()))
  );
}

function stamp(value: unknown): string | null {
  return opsIso(value);
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

  const [scanStampRows, waitlistRows, checkinRows] = await Promise.all([
    db
      .select({
        userId: scans.userId,
        createdAt: scans.createdAt,
      })
      .from(scans),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(preReleaseSignups),
    db
      .select({ n: sql<number>`count(distinct ${wellnessCheckins.userId})::int` })
      .from(wellnessCheckins),
  ]);

  const scanByUser = new Map<
    string,
    { scanCount: number; lastScanAt: Date | null; scanAtList: string[] }
  >();
  for (const row of scanStampRows) {
    const iso = stamp(row.createdAt);
    const instant = iso ? new Date(iso) : null;
    const current = scanByUser.get(row.userId) ?? {
      scanCount: 0,
      lastScanAt: null as Date | null,
      scanAtList: [] as string[],
    };
    current.scanCount += 1;
    if (iso) current.scanAtList.push(iso);
    if (instant && (!current.lastScanAt || instant > current.lastScanAt)) {
      current.lastScanAt = instant;
    }
    scanByUser.set(row.userId, current);
  }

  const loginByUser = new Map<string, string[]>();
  let loggedInLast7Days = 0;
  try {
    const loginStampRows = await db
      .select({
        userId: loginEvents.userId,
        createdAt: loginEvents.createdAt,
      })
      .from(loginEvents);
    for (const row of loginStampRows) {
      const iso = stamp(row.createdAt);
      if (iso) {
        const list = loginByUser.get(row.userId) ?? [];
        list.push(iso);
        loginByUser.set(row.userId, list);
      }
    }
  } catch (error) {
    if (!missingColumn(error, "login_events")) {
      console.warn("[ops] login_events query skipped", error);
    }
  }

  const patients: OpsPatientRow[] = patientRows.map((row) => {
    const scan = scanByUser.get(row.id);
    const loginAtList = loginByUser.get(row.id) ?? [];
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
      signedUpAt: stamp(row.createdAt) ?? "",
      lastLoginAt:
        stamp(row.lastLoginAt) ??
        (loginAtList.length > 0
          ? [...loginAtList].sort().at(-1) ?? null
          : null),
      loginAtList,
      hasScan: Boolean(scan && scan.scanCount > 0),
      scanCount: scan?.scanCount ?? 0,
      lastScanAt: stamp(scan?.lastScanAt ?? null),
      scanAtList: scan?.scanAtList ?? [],
      questionnaireDone,
      questionnaireAt: stamp(row.onboardingCompletedAt),
    };
  });

  const signedUp = patients.length;
  const loggedIn = patients.filter((p) => hasReturnedToPortal(p)).length;
  const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekUsers = new Set<string>();
  for (const patient of patients) {
    const stamps = [
      patient.lastLoginAt,
      patient.lastScanAt,
      patient.questionnaireAt,
      ...patient.loginAtList,
      ...patient.scanAtList,
    ];
    if (stamps.some((stamp) => stamp && Date.parse(stamp) >= since)) {
      weekUsers.add(patient.id);
    }
  }
  loggedInLast7Days = weekUsers.size;
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
