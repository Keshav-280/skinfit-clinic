import { ParameterRow } from "./ParameterRow";
import type { MovementGroups, MovementRow } from "@/src/lib/report/buildMovementGroups";

type MovementSectionProps = {
  groups: MovementGroups;
};

function GroupHeader({
  label,
  tone,
}: {
  label: string;
  tone: "good" | "hold" | "track";
}) {
  const color =
    tone === "good"
      ? "text-kai-good"
      : tone === "track"
        ? "text-[#A87C22]"
        : "text-kai-ink-3";
  return (
    <div className="mb-1 mt-5 flex items-center gap-3 first:mt-0">
      <h3
        className={`shrink-0 text-[10px] font-bold uppercase tracking-[0.14em] ${color}`}
      >
        {label}
      </h3>
      <div className="h-px flex-1 bg-kai-rule" />
    </div>
  );
}

function Rows({ rows }: { rows: MovementRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-2 text-[12px] leading-[1.5] text-kai-ink-3">
        Nothing in this group this week.
      </p>
    );
  }
  return (
    <>
      {rows.map((r) => (
        <ParameterRow
          key={r.key}
          name={r.name}
          grade={r.grade}
          gradeColor={r.gradeColor}
          finding={r.finding}
          note={r.note}
          movement={r.movement}
        />
      ))}
    </>
  );
}

export function MovementSection({ groups }: MovementSectionProps) {
  return (
    <section className="border-b border-kai-rule px-6 py-[26px]">
      <h2 className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.15em] text-kai-ink-3">
        What moved
      </h2>
      <p className="mb-4 text-[11.5px] leading-[1.45] text-kai-ink-3">
        Only markers that can change on this timescale report movement. The rest
        stay in Tracking until their cycle is due.
      </p>
      <GroupHeader label="Improved" tone="good" />
      <Rows rows={groups.improved} />
      <GroupHeader label="Holding" tone="hold" />
      <Rows rows={groups.holding} />
      <GroupHeader label="Tracking" tone="track" />
      <Rows rows={groups.tracking} />
    </section>
  );
}
