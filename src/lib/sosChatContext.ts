import { desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { scans, visitNotes } from "@/src/db/schema";

/** Prefix appended to SOS patient messages: last visits + last scan summary. */
export async function buildSosContextPrefix(patientUserId: string): Promise<string> {
  const visits = await db
    .select({
      visitDate: visitNotes.visitDate,
      purpose: visitNotes.purpose,
      treatments: visitNotes.treatments,
      notes: visitNotes.notes,
    })
    .from(visitNotes)
    .where(eq(visitNotes.userId, patientUserId))
    .orderBy(desc(visitNotes.visitDate))
    .limit(3);

  const [lastScan] = await db
    .select({
      overallScore: scans.overallScore,
      createdAt: scans.createdAt,
      scanName: scans.scanName,
    })
    .from(scans)
    .where(eq(scans.userId, patientUserId))
    .orderBy(desc(scans.createdAt))
    .limit(1);

  const lines: string[] = ["🚨 SOS — auto context for doctors"];
  lines.push("\n**Last visits (up to 3)**");
  if (visits.length === 0) {
    lines.push("- (none on file)");
  } else {
    for (const v of visits) {
      const d = v.visitDate.toISOString().slice(0, 10);
      const p = v.purpose?.trim() || "—";
      const t = v.treatments?.trim() || "—";
      lines.push(`- ${d}: ${p} | Treatments: ${t}`);
      if (v.notes?.trim()) {
        lines.push(`  Notes: ${v.notes.trim().slice(0, 280)}`);
      }
    }
  }
  lines.push("\n**Latest scan**");
  if (!lastScan) {
    lines.push("- (no scan on file)");
  } else {
    lines.push(
      `- ${lastScan.createdAt.toISOString().slice(0, 10)} · kAI overall ${lastScan.overallScore}${lastScan.scanName ? ` · ${lastScan.scanName}` : ""}`
    );
  }
  lines.push("\n**Patient message**");
  return lines.join("\n");
}
