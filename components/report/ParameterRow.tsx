import type { KaiGradeTone } from "@/src/lib/kaiReportMapping";

type ParameterRowProps = {
  name: string;
  grade: string;
  gradeColor: KaiGradeTone;
  finding: string;
  note?: string;
  movement?: { tag: string; type: "up" | "hold" | "track" | "down" };
};

const DOT: Record<KaiGradeTone, string> = {
  good: "bg-kai-good",
  mid: "bg-kai-mid",
  low: "bg-kai-low",
};

const MV: Record<"up" | "hold" | "track" | "down", string> = {
  up: "bg-[rgba(78,155,114,0.14)] text-kai-good",
  hold: "bg-[rgba(139,147,164,0.14)] text-kai-ink-3",
  track: "bg-[rgba(212,160,63,0.14)] text-[#A87C22]",
  down: "bg-[rgba(196,105,79,0.14)] text-kai-low",
};

export function ParameterRow({
  name,
  grade,
  gradeColor,
  finding,
  note,
  movement,
}: ParameterRowProps) {
  return (
    <div className="border-b border-kai-rule py-[13px] last:border-b-0 last:pb-0">
      <div className="mb-[5px] flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[13.5px] font-semibold text-kai-ink">
          <span className={`block h-1.5 w-1.5 rounded-full ${DOT[gradeColor]}`} />
          {name}
        </span>
        <span className="flex items-center gap-[9px]">
          {movement ? (
            <span
              className={`rounded px-[7px] py-[3px] text-[9.5px] font-bold uppercase tracking-[0.07em] ${MV[movement.type]}`}
            >
              {movement.tag}
            </span>
          ) : null}
          <span className="font-serif text-[17px] font-normal tracking-[-0.01em] text-kai-ink">
            {grade}
          </span>
        </span>
      </div>
      <p className="text-[12.5px] leading-[1.55] text-kai-ink-2">{finding}</p>
      {note ? (
        <p className="mt-1.5 border-l-2 border-kai-rule pl-2.5 text-[11px] leading-[1.5] text-kai-ink-3">
          {note}
        </p>
      ) : null}
    </div>
  );
}
