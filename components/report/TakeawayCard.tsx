import { REPORT_CARD, firstSentences } from "./reportCopy";

type TakeawayCardProps = {
  text: string;
  kicker?: string;
};

export function TakeawayCard({ text, kicker = "Takeaway" }: TakeawayCardProps) {
  return (
    <section className={`${REPORT_CARD} relative overflow-hidden px-4 py-5`}>
      <span
        className="pointer-events-none absolute -left-1 -top-6 select-none text-[92px] leading-none text-[#2C3E6B]/10"
        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        aria-hidden
      >
        “
      </span>
      <p className="relative mb-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#2C3E6B]/55">
        {kicker}
      </p>
      <p
        className="relative text-[16px] font-medium leading-[1.4] tracking-[-0.015em] text-[#1A2035]"
        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
      >
        {firstSentences(text, 2)}
      </p>
    </section>
  );
}
