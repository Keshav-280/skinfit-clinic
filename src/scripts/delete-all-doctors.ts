/**
 * Delete all doctor/admin portal users and related rows on local Docker Postgres.
 * Does NOT delete patient users or their scans.
 *
 * Mirrors drizzle/scripts/reset_doctor_data_docker.sql (+ doctor_profile_images).
 *
 * Usage:
 *   CONFIRM_DELETE_ALL_DOCTORS=1 LOCAL_POSTGRES_URL='postgresql://skinfit:skinfit_local_dev@127.0.0.1:5433/skinfit' \
 *     npx tsx src/scripts/delete-all-doctors.ts
 */
import "dotenv/config";
import { Pool } from "pg";

const CONFIRM = process.env.CONFIRM_DELETE_ALL_DOCTORS === "1";
const DEFAULT_LOCAL_URL =
  "postgresql://skinfit:skinfit_local_dev@127.0.0.1:5433/skinfit";

const STAFF_ROLES_SQL = `role IN ('doctor', 'admin')`;
const STAFF_IDS_SQL = `SELECT id FROM users WHERE ${STAFF_ROLES_SQL}`;

function resolveDatabaseUrl(): string {
  return (
    process.env.LOCAL_POSTGRES_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    DEFAULT_LOCAL_URL
  );
}

/** Refuse hosted/production databases; allow loopback and docker service hostname. */
function assertLocalPostgresOnly(connectionString: string): void {
  let host: string;
  try {
    host = new URL(connectionString).hostname.toLowerCase();
  } catch {
    throw new Error(`Invalid database URL: ${connectionString}`);
  }

  const localHosts = new Set(["127.0.0.1", "localhost", "::1", "postgres"]);
  if (!localHosts.has(host)) {
    throw new Error(
      `Refusing non-local host "${host}". Use Docker Postgres at 127.0.0.1:5433 ` +
        `(LOCAL_POSTGRES_URL) for this script.`
    );
  }

  const lower = connectionString.toLowerCase();
  if (
    lower.includes("neon.tech") ||
    lower.includes("rds.amazonaws.com") ||
    lower.includes("supabase.co")
  ) {
    throw new Error("Refusing hosted/production database URL.");
  }
}

async function runStep(
  pool: Pool,
  label: string,
  sql: string
): Promise<number> {
  const result = await pool.query(sql);
  return result.rowCount ?? 0;
}

async function main() {
  if (!CONFIRM) {
    console.error(
      "Refusing to run without CONFIRM_DELETE_ALL_DOCTORS=1.\n" +
        "Example:\n" +
        "  CONFIRM_DELETE_ALL_DOCTORS=1 LOCAL_POSTGRES_URL='postgresql://skinfit:skinfit_local_dev@127.0.0.1:5433/skinfit' \\\n" +
        "    npx tsx src/scripts/delete-all-doctors.ts"
    );
    process.exit(1);
  }

  const url = resolveDatabaseUrl();
  assertLocalPostgresOnly(url);

  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();

  try {
    const before = await client.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM users WHERE ${STAFF_ROLES_SQL}`
    );
    const doctorCountBefore = Number(before.rows[0]?.n ?? 0);

    const patientBefore = await client.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM users WHERE role = 'patient'`
    );
    const patientCountBefore = Number(patientBefore.rows[0]?.n ?? 0);

    console.log(`Target: ${url}`);
    console.log(
      `Before: ${doctorCountBefore} doctor/admin user(s), ${patientCountBefore} patient(s)`
    );

    if (doctorCountBefore === 0) {
      console.log("No doctor/admin users to delete.");
      return;
    }

    await client.query("BEGIN");

    const steps: Array<{ label: string; sql: string }> = [
      {
        label: "doctor_sos_acknowledgements",
        sql: `DELETE FROM doctor_sos_acknowledgements WHERE staff_user_id IN (${STAFF_IDS_SQL})`,
      },
      {
        label: "chat_thread_e2ee_envelopes (doctor threads)",
        sql: `DELETE FROM chat_thread_e2ee_envelopes WHERE thread_id IN (SELECT id FROM chat_threads WHERE assistant_id = 'doctor')`,
      },
      {
        label: "chat_messages (doctor threads)",
        sql: `DELETE FROM chat_messages WHERE thread_id IN (SELECT id FROM chat_threads WHERE assistant_id = 'doctor')`,
      },
      {
        label: "chat_threads (assistant_id = doctor)",
        sql: `DELETE FROM chat_threads WHERE assistant_id = 'doctor'`,
      },
      {
        label: "chat_user_e2ee_keys (staff)",
        sql: `DELETE FROM chat_user_e2ee_keys WHERE user_id IN (${STAFF_IDS_SQL})`,
      },
      {
        label: "doctor_feedback_voice_notes",
        sql: `DELETE FROM doctor_feedback_voice_notes`,
      },
      {
        label: "doctor_patient_care",
        sql: `DELETE FROM doctor_patient_care`,
      },
      {
        label: "visit_notes",
        sql: `DELETE FROM visit_notes`,
      },
      {
        label: "doctor_profile_images",
        sql: `DELETE FROM doctor_profile_images WHERE owner_user_id IN (${STAFF_IDS_SQL})`,
      },
      {
        label: "scans.doctor_id cleared",
        sql: `UPDATE scans SET doctor_id = NULL WHERE doctor_id IS NOT NULL`,
      },
      {
        label: "skin_dna_cards.doctor_id cleared",
        sql: `UPDATE skin_dna_cards SET doctor_id = NULL WHERE doctor_id IS NOT NULL`,
      },
      {
        label: "weekly_reports.doctor_id cleared",
        sql: `UPDATE weekly_reports SET doctor_id = NULL WHERE doctor_id IS NOT NULL`,
      },
      {
        label: "monthly_reports.doctor_id cleared",
        sql: `UPDATE monthly_reports SET doctor_id = NULL WHERE doctor_id IS NOT NULL`,
      },
      {
        label: "patient users feedback/assignment cleared",
        sql: `UPDATE users SET
          assigned_doctor_id = NULL,
          doctor_feedback_note = NULL,
          doctor_feedback_updated_at = NULL,
          doctor_feedback_viewed_at = NULL,
          doctor_feedback_scan_voice_viewed_at = NULL,
          clinic_visited_at = NULL
        WHERE role = 'patient'`,
      },
      {
        label: "appointments",
        sql: `DELETE FROM appointments`,
      },
      {
        label: "appointment_requests",
        sql: `DELETE FROM appointment_requests`,
      },
      {
        label: "doctor_slots",
        sql: `DELETE FROM doctor_slots`,
      },
      {
        label: "users (doctor/admin)",
        sql: `DELETE FROM users WHERE ${STAFF_ROLES_SQL}`,
      },
    ];

    const report: Array<{ label: string; rows: number }> = [];
    for (const step of steps) {
      const result = await client.query(step.sql);
      report.push({ label: step.label, rows: result.rowCount ?? 0 });
    }

    await client.query("COMMIT");

    const after = await client.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM users WHERE ${STAFF_ROLES_SQL}`
    );
    const patientAfter = await client.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM users WHERE role = 'patient'`
    );

    console.log("\nDeleted / updated rows:");
    for (const { label, rows } of report) {
      if (rows > 0) console.log(`  ${label}: ${rows}`);
    }

    console.log(
      `\nAfter: ${Number(after.rows[0]?.n ?? 0)} doctor/admin user(s), ` +
        `${Number(patientAfter.rows[0]?.n ?? 0)} patient(s) (unchanged count expected)`
    );
    console.log("\nDone. Re-seed doctors with: npm run db:seed");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
