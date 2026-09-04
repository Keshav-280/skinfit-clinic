/**
 * Upsert the SkinFit clinic staff doctor login.
 * Usage: npx tsx src/scripts/upsert-clinic-staff-doctor.ts
 */
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db } from "@/src/db/client";
import { users } from "@/src/db/schema";
import {
  CLINIC_STAFF_EMAIL,
  CLINIC_STAFF_NAME,
  CLINIC_STAFF_PASSWORD,
} from "@/src/lib/auth/fallbackDoctorIdentity";

async function main() {
  const passwordHash = await bcrypt.hash(CLINIC_STAFF_PASSWORD, 10);
  const email = CLINIC_STAFF_EMAIL.toLowerCase();

  const [existing] = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);

  if (existing) {
    await db
      .update(users)
      .set({
        passwordHash,
        role: "doctor",
        name: CLINIC_STAFF_NAME,
        email,
      })
      .where(sql`lower(${users.email}) = ${email}`);
    console.log(`Updated doctor ${email} (${existing.id})`);
  } else {
    const [created] = await db
      .insert(users)
      .values({
        name: CLINIC_STAFF_NAME,
        email,
        passwordHash,
        role: "doctor",
      })
      .returning({ id: users.id, email: users.email });
    console.log(`Created doctor ${created?.email} (${created?.id})`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
