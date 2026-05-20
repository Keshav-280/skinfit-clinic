/**
 * Reset E2EE thread envelopes for one doctor↔patient chat thread.
 *
 * Use when you see: "Secure chat keys exist for this thread but not for this account"
 * or mixed plain / e2ee:v1 messages after a bad key rotation.
 *
 * This does NOT delete chat messages or user public keys — only wrapped thread keys.
 * After reset, patient and doctor must each open doctor chat once so keys re-bootstrap.
 *
 * Usage:
 *   npm run chat:e2ee:reset -- --patient-email demo@skinfit.app
 *   npm run chat:e2ee:reset -- --patient-id <uuid>
 *   npm run chat:e2ee:reset -- --thread-id <uuid>
 *   npm run chat:e2ee:reset -- --patient-email demo@skinfit.app --dry-run
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "@/src/db/client";
import {
  chatThreadE2eeEnvelopes,
  chatThreads,
  users,
} from "@/src/db/schema";
import {
  findDoctorThreadId,
  listThreadEnvelopeUserIds,
} from "@/src/lib/chatE2ee/store";

function usage(): never {
  console.error(`
Reset doctor-chat E2EE envelopes (wrapped thread keys only).

  npm run chat:e2ee:reset -- --patient-email <email>
  npm run chat:e2ee:reset -- --patient-id <uuid>
  npm run chat:e2ee:reset -- --thread-id <uuid>
  npm run chat:e2ee:reset -- --patient-email <email> --dry-run

Options:
  --dry-run   List what would be deleted without writing
  --yes       Skip confirmation prompt
`);
  process.exit(1);
}

function readArg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1) return undefined;
  return process.argv[i + 1]?.trim() || undefined;
}

async function resolveThreadId(opts: {
  patientEmail?: string;
  patientId?: string;
  threadId?: string;
}): Promise<{ threadId: string; patientId: string }> {
  if (opts.threadId) {
    const [thread] = await db
      .select({
        id: chatThreads.id,
        userId: chatThreads.userId,
        assistantId: chatThreads.assistantId,
      })
      .from(chatThreads)
      .where(eq(chatThreads.id, opts.threadId))
      .limit(1);
    if (!thread) {
      throw new Error(`Thread not found: ${opts.threadId}`);
    }
    if (thread.assistantId !== "doctor") {
      throw new Error(`Thread ${opts.threadId} is not a doctor thread (assistant=${thread.assistantId})`);
    }
    return { threadId: thread.id, patientId: thread.userId };
  }

  let patientId = opts.patientId;
  if (!patientId && opts.patientEmail) {
    const [row] = await db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(eq(users.email, opts.patientEmail.toLowerCase()))
      .limit(1);
    if (!row) throw new Error(`No user with email ${opts.patientEmail}`);
    if (row.role !== "patient") {
      throw new Error(`User ${opts.patientEmail} is role=${row.role}, expected patient`);
    }
    patientId = row.id;
  }

  if (!patientId) {
    usage();
  }

  const threadId = await findDoctorThreadId(patientId);
  if (!threadId) {
    throw new Error(
      `No doctor chat thread for patient ${patientId}. Nothing to reset (thread created on first message).`
    );
  }
  return { threadId, patientId };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const skipConfirm = process.argv.includes("--yes");
  const patientEmail = readArg("--patient-email");
  const patientIdArg = readArg("--patient-id");
  const threadIdArg = readArg("--thread-id");

  if (!patientEmail && !patientIdArg && !threadIdArg) {
    usage();
  }

  const { threadId, patientId } = await resolveThreadId({
    patientEmail,
    patientId: patientIdArg,
    threadId: threadIdArg,
  });

  const [patient] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, patientId))
    .limit(1);

  const envelopeUserIds = await listThreadEnvelopeUserIds(threadId);
  if (envelopeUserIds.length === 0) {
    console.log("No E2EE envelopes on this thread — already reset or never bootstrapped.");
    console.log(`threadId=${threadId} patientId=${patientId}`);
    return;
  }

  const participants: Array<{
    id: string;
    name: string | null;
    email: string | null;
    role: string;
  }> = [];
  for (const uid of envelopeUserIds) {
    const [u] = await db
      .select({ id: users.id, name: users.name, email: users.email, role: users.role })
      .from(users)
      .where(eq(users.id, uid))
      .limit(1);
    if (u) participants.push(u);
  }

  const [latestThread] = await db
    .select({ createdAt: chatThreads.createdAt })
    .from(chatThreads)
    .where(eq(chatThreads.id, threadId))
    .limit(1);

  console.log("Doctor chat E2EE reset");
  console.log("──────────────────────");
  console.log(`threadId:    ${threadId}`);
  console.log(`patient:     ${patient?.name ?? "?"} <${patient?.email ?? patientId}>`);
  console.log(`patientId:   ${patientId}`);
  if (latestThread?.createdAt) {
    console.log(`thread since: ${latestThread.createdAt.toISOString()}`);
  }
  console.log(`envelopes:   ${envelopeUserIds.length}`);
  for (const p of participants) {
    console.log(`  - ${p.role} ${p.name ?? "?"} <${p.email ?? p.id}> (${p.id})`);
  }
  console.log("");
  console.log(
    "Note: Existing messages stay in DB. Old e2ee:v1 rows may show as undecryptable until you send new messages after re-bootstrap."
  );

  if (dryRun) {
    console.log("\n[dry-run] Would delete all envelopes for this thread. No changes made.");
    return;
  }

  if (!skipConfirm) {
    console.log("\nType RESET to continue:");
    const answer = await new Promise<string>((resolve) => {
      process.stdin.setEncoding("utf8");
      process.stdin.once("data", (d) => resolve(String(d).trim()));
    });
    if (answer !== "RESET") {
      console.log("Aborted.");
      process.exit(0);
    }
  }

  const deleted = await db
    .delete(chatThreadE2eeEnvelopes)
    .where(eq(chatThreadE2eeEnvelopes.threadId, threadId))
    .returning({ userId: chatThreadE2eeEnvelopes.userId });

  console.log(`\nDeleted ${deleted.length} envelope row(s).`);
  console.log("\nNext steps:");
  console.log("  1. Deploy latest app (E2EE fixes) if not already.");
  console.log("  2. Patient opens Dashboard → Chat → Dr Ruby and waits for green encrypted status.");
  console.log("  3. Doctor opens that patient in portal → Chat and waits for E2EE badge.");
  console.log("  4. Send a test message from each side — DB text should start with e2ee:v1:");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
