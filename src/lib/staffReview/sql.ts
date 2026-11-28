import { sql, type SQL } from "drizzle-orm";
import { scans } from "@/src/db/schema";
import { isStaffScored } from "@/src/lib/staffReview/model";

/**
 * Add to a query for earlier scans: when the current scan was scored by staff, only staff-scored
 * scans qualify. Returns undefined (no condition) otherwise.
 */
export function comparableScanCondition(currentScores: unknown): SQL | undefined {
  return isStaffScored(currentScores) ? sql`(${scans.scores} -> 'staffReview') IS NOT NULL` : undefined;
}
