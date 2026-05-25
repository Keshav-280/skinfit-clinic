/**
 * Full E2EE reset — delete all server encryption state and encrypted message bodies.
 *
 * After running:
 *  1. Doctor (web): DevTools → Application → Local Storage → remove
 *     skinfit_e2ee_private_jwk and skinfit_e2ee_public_jwk (or clear site data).
 *  2. Patient (mobile): reinstall app OR clear app storage; keys live in AsyncStorage.
 *  3. Both open doctor chat once — new keys register, then send a test message.
 *
 * Usage:
 *   npm run chat:e2ee:reset-all -- --yes
 *   npm run chat:e2ee:reset-all -- --dry-run
 *   npm run chat:e2ee:reset-all -- --yes --keep-messages
 */
import "dotenv/config";
import { clearAllServerE2eeState } from "@/src/lib/chatE2ee/store";

function usage(): never {
  console.error(`
Full chat E2EE reset (all threads, all users).

  npm run chat:e2ee:reset-all -- --yes
  npm run chat:e2ee:reset-all -- --dry-run
  npm run chat:e2ee:reset-all -- --yes --keep-messages

Options:
  --dry-run        Show what would run (no DB writes)
  --yes            Skip confirmation prompt
  --keep-messages  Only delete keys/envelopes; leave e2ee:v1 rows in chat_messages
`);
  process.exit(1);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const skipConfirm = process.argv.includes("--yes");
  const keepMessages = process.argv.includes("--keep-messages");

  if (!dryRun && !skipConfirm && !process.argv.includes("--help")) {
    console.log("This will DELETE:");
    console.log("  • All chat_thread_e2ee_envelopes (wrapped thread keys)");
    console.log("  • All chat_user_e2ee_keys (registered public keys)");
    if (!keepMessages) {
      console.log("  • All chat_messages with text starting with e2ee:v1:");
    } else {
      console.log("  • (keeping encrypted message rows — use --keep-messages)");
    }
    console.log("\nDevice private keys are NOT on the server — clear them manually (see script header).\n");
    console.log("Type RESET-ALL to continue:");
    const answer = await new Promise<string>((resolve) => {
      process.stdin.setEncoding("utf8");
      process.stdin.once("data", (d) => resolve(String(d).trim()));
    });
    if (answer !== "RESET-ALL") {
      console.log("Aborted.");
      process.exit(0);
    }
  }

  if (process.argv.includes("--help")) {
    usage();
  }

  if (dryRun) {
    console.log("[dry-run] Would call clearAllServerE2eeState:", {
      deleteEncryptedMessages: !keepMessages,
    });
    return;
  }

  const result = await clearAllServerE2eeState({
    deleteEncryptedMessages: !keepMessages,
  });

  console.log("E2EE server reset complete");
  console.log("────────────────────────");
  console.log(`envelopes deleted:          ${result.envelopesDeleted}`);
  console.log(`user public keys deleted:   ${result.userKeysDeleted}`);
  console.log(`encrypted messages deleted: ${result.encryptedMessagesDeleted}`);
  console.log("\nNext: clear device keys, reopen chat on doctor + patient, send new messages.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
