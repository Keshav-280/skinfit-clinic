import type { Metadata } from "next";
import { ScoreboardView } from "@/components/ops/ScoreboardView";
import { loadScoreboard } from "@/src/lib/scoreboard/loadScoreboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Scoreboard",
  description: "Weekly app numbers to share with the team.",
};

export default async function ClinicScoreboardPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const params = await searchParams;
  const parsed = Number.parseInt(params.week ?? "0", 10);
  const data = await loadScoreboard(Number.isFinite(parsed) ? parsed : 0);
  return <ScoreboardView data={data} />;
}
