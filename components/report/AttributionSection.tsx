type AttributionCard = {
  label: string;
  text: string;
};

type AttributionSectionProps = {
  cards: AttributionCard[];
};

export function AttributionSection({ cards }: AttributionSectionProps) {
  if (cards.length === 0) return null;

  return (
    <section className="border-b border-kai-rule px-6 py-[26px]">
      <h2 className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.15em] text-kai-ink-3">
        What likely shaped it
      </h2>
      <p className="mb-4 text-[11.5px] leading-[1.45] text-kai-ink-3">
        Correlation only — not causation. Patterns from your check-in, local
        weather, and clinic record.
      </p>
      <div className="flex flex-col gap-2.5">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-[12px] bg-kai-sage px-3.5 py-3"
          >
            <p className="mb-1.5 text-[9.5px] font-bold uppercase tracking-[0.12em] text-kai-ink-3">
              {card.label}
            </p>
            <p className="text-[12.5px] leading-[1.55] text-kai-ink-2">
              {card.text}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
