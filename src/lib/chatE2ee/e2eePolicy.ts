import { isDoctorChatE2eeEnabled } from "@/src/lib/chatDoctorE2eeConfig";
import { isE2eePayload } from "@/src/lib/chatE2ee/format";
import { threadHasE2eeEnvelopes } from "@/src/lib/chatE2ee/store";

/** Doctor thread messages must be ciphertext once thread keys exist (SOS prefix may stay plain). */
export async function doctorThreadRequiresE2ee(
  threadId: string
): Promise<boolean> {
  if (!isDoctorChatE2eeEnabled()) return false;
  return threadHasE2eeEnvelopes(threadId);
}

export function isPlaintextDoctorMessageAllowed(text: string): boolean {
  if (!text.trim()) return true;
  if (isE2eePayload(text)) return true;
  // Attachment-only rows use a fixed label; binary stays in attachment_url.
  if (text === "🖼️ Image" || text === "🎤 Voice note") return true;
  // SOS auto-prefix from patient flow — not E2EE but allowed once per urgent send.
  if (text.includes("SOS — auto context for doctors")) return true;
  return false;
}
