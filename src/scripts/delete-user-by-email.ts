/**
 * Delete a user and all cascaded patient data by email.
 * Usage: npx tsx src/scripts/delete-user-by-email.ts developer@skinfitwellness.in
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/src/db/client";
import {
  oauthAccounts,
  parameterScores,
  scans,
  users,
} from "@/src/db/schema";
import { deletePatientAccount } from "@/src/lib/deletePatientAccount";
import {
  invalidateUserHomeCache,
  invalidateUserInsightsCache,
  invalidateUserScanDerivedCaches,
} from "@/src/lib/infra";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: npx tsx src/scripts/delete-user-by-email.ts <email>");
    process.exit(1);
  }

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      name: users.name,
    })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);

  if (!user) {
    console.log(`No user found for ${email}`);
    process.exit(0);
  }

  console.log("Found user:", user);

  const patientScans = await db
    .select({ id: scans.id })
    .from(scans)
    .where(eq(scans.userId, user.id));
  console.log(`Scans: ${patientScans.length}`);

  if (user.role === "patient") {
    const result = await deletePatientAccount(user.id);
    if (!result.ok) {
      console.error("deletePatientAccount failed:", result.error);
      process.exit(1);
    }
    console.log("Deleted patient account (user row + cascaded data).");
  } else {
    const scanIds = patientScans.map((s) => s.id);
    await db.transaction(async (tx) => {
      if (scanIds.length > 0) {
        await tx
          .delete(parameterScores)
          .where(inArray(parameterScores.scanId, scanIds));
      }
      await tx.delete(oauthAccounts).where(eq(oauthAccounts.userId, user.id));
      const deleted = await tx
        .delete(users)
        .where(eq(users.id, user.id))
        .returning({ id: users.id });
      if (deleted.length === 0) {
        throw new Error("USER_DELETE_EMPTY");
      }
    });
    console.log(`Deleted ${user.role} account.`);
  }

  await Promise.all([
    invalidateUserHomeCache(user.id),
    invalidateUserScanDerivedCaches(user.id),
    invalidateUserInsightsCache(user.id),
  ]);

  const remaining = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`);
  console.log(
    remaining.length === 0
      ? "Verified: no user row remains."
      : "WARNING: user row still exists."
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
