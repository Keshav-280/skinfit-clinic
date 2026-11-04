import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { scans, users } from "@/src/db/schema";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Scan inspector" };

export default async function OpsScansPage() {
  const rows = await db
    .select({
      id: scans.id,
      createdAt: scans.createdAt,
      name: users.name,
      email: users.email,
      overall: scans.overallScore,
      acne: scans.acne,
      pigmentation: scans.pigmentation,
      wrinkles: scans.wrinkles,
    })
    .from(scans)
    .innerJoin(users, eq(users.id, scans.userId))
    .orderBy(desc(scans.createdAt))
    .limit(100);

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#1E1B31]">Scan inspector</h1>
        <Link href="/clinic/ops" className="text-sm font-semibold text-[#2B2F63] underline">
          Back to Ops
        </Link>
      </div>
      <p className="text-sm text-[#6B7280]">
        Latest 100 scans. Open one to see the exact circles, zones and lines the patient sees, plus the raw numbers
        behind each score.
      </p>
      <div className="overflow-x-auto rounded-xl border border-[#E4E6F0] bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[#F0EAE2] text-left text-xs uppercase text-[#1E1B31]">
            <tr>
              <th className="p-2">Scan</th>
              <th className="p-2">Patient</th>
              <th className="p-2">When</th>
              <th className="p-2">Overall</th>
              <th className="p-2">Acne</th>
              <th className="p-2">Pigm.</th>
              <th className="p-2">Wrinkles</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[#E4E6F0]">
                <td className="p-2">
                  <Link href={`/clinic/ops/scans/${r.id}`} className="font-semibold text-[#2B2F63] underline">
                    #{r.id}
                  </Link>
                </td>
                <td className="p-2">{r.name || r.email}</td>
                <td className="p-2">{r.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                <td className="p-2">{r.overall}</td>
                <td className="p-2">{r.acne}</td>
                <td className="p-2">{r.pigmentation}</td>
                <td className="p-2">{r.wrinkles}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
