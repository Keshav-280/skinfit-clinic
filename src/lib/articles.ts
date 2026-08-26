export type ArticleSection = {
  heading: string;
  paragraphs: string[];
};

export type Article = {
  slug: string;
  title: string;
  category: string;
  readTime: string;
  /** Expected at /public/images/articles/<file>. Falls back to a gradient card if missing. */
  imageSrc: string;
  excerpt: string;
  sections: ArticleSection[];
};

export const ARTICLES: Article[] = [
  {
    slug: "understanding-your-skin-type",
    title: "Understanding Your Skin Type: A Complete Guide",
    category: "Skin Basics",
    readTime: "5 min",
    imageSrc: "/images/articles/skin-type-guide.png",
    excerpt:
      "Oily, dry, combination, normal, or sensitive — most people are guessing. Here's how to actually know, and why it changes everything about your routine.",
    sections: [
      {
        heading: "Why skin type is the first thing to get right",
        paragraphs: [
          "Every skincare recommendation you'll ever get — from a cleanser to a sunscreen — assumes you know your skin type. Get it wrong, and even expensive products can leave you worse off: a heavy cream on oily skin clogs pores, while a foaming cleanser on dry skin strips it further.",
          "Skin type isn't fixed either. It can shift with the seasons, your age, stress levels, and even the water you use to wash your face. That's part of why a one-time guess rarely holds up.",
        ],
      },
      {
        heading: "The five types, in plain terms",
        paragraphs: [
          "Oily skin produces more sebum than it needs, showing up as shine, enlarged pores, and a tendency toward breakouts — especially around the T-zone.",
          "Dry skin doesn't produce enough natural oil, leading to tightness, flaking, and sometimes a dull or rough texture, particularly after cleansing.",
          "Combination skin is oily in some areas (usually forehead, nose, chin) and normal-to-dry in others (cheeks) — the most common type, and often the most confusing to shop for.",
          "Normal skin is well-balanced: not too oily, not too dry, with a fairly even texture and few sensitivities.",
          "Sensitive skin reacts easily — redness, stinging, or irritation from products, weather, or fabrics — and can overlap with any of the four types above.",
        ],
      },
      {
        heading: "A simple way to check at home",
        paragraphs: [
          "Wash your face with a gentle cleanser and don't apply anything after. Wait 30 minutes, then look in good light: shine across your whole face usually means oily, tightness or flaking means dry, shine only on the T-zone means combination, and no real change either way usually means normal.",
          "This test is a decent starting point, but it doesn't account for the deeper patterns a proper scan can pick up — pore size, hydration levels beneath the surface, and how your skin is actually behaving over time rather than in one 30-minute window.",
        ],
      },
      {
        heading: "Where kAI fits in",
        paragraphs: [
          "Your kAI scan measures skin type alongside acne, pigmentation, wrinkles, hydration, and texture — so instead of a guess, you get a reading that's tracked scan over scan. That's what powers the personalized routine suggestions you see on your Build tab.",
        ],
      },
    ],
  },
  {
    slug: "how-indian-climate-affects-skin",
    title: "How Indian Climate Affects Your Skin Health",
    category: "Climate & Skin",
    readTime: "4 min",
    imageSrc: "/images/articles/climate-skin.png",
    excerpt:
      "From monsoon humidity to peak summer UV, India's climate swings put unusual stress on skin — here's what changes each season and how to adapt.",
    sections: [
      {
        heading: "One country, several very different climates",
        paragraphs: [
          "Skincare advice written for temperate, low-humidity climates often doesn't translate well to Indian conditions. High humidity for months at a time, intense UV exposure near the equator, and heavy air pollution in many cities all place specific, compounding demands on skin.",
        ],
      },
      {
        heading: "Summer: heat, sweat, and UV load",
        paragraphs: [
          "Prolonged heat increases sweat and sebum production, which can trigger breakouts and clogged pores even in people who don't normally struggle with acne. India's UV index also runs high for much of the year, accelerating pigmentation and early signs of ageing if sunscreen isn't a daily habit — not just an occasional one.",
        ],
      },
      {
        heading: "Monsoon: humidity's double edge",
        paragraphs: [
          "Humidity keeps skin from drying out, but it also creates ideal conditions for fungal and bacterial breakouts, especially with sweat and pollution sitting on the skin for longer. Lightweight, non-comedogenic products tend to work better than rich creams during this stretch.",
        ],
      },
      {
        heading: "Winter and pollution: an underrated combination",
        paragraphs: [
          "Even in warmer regions, winter air tends to be drier, and in many Indian cities it also carries significantly more particulate pollution. That combination — lower humidity plus more airborne particulates settling on skin — shows up as dullness, dehydration, and a rougher texture that sunscreen and moisturizer alone don't fully address; a proper cleanse each evening matters more this season than most people realize.",
        ],
      },
      {
        heading: "Adjusting instead of guessing",
        paragraphs: [
          "The core lesson isn't to buy more products — it's to adjust the same routine's weight and frequency with the season. kAI's weekly check-in factors in your city and the season when it reviews your scan trends, which is why routine suggestions sometimes shift even when your underlying skin type hasn't changed.",
        ],
      },
    ],
  },
  {
    slug: "science-behind-kai-skin-score",
    title: "The Science Behind kAI Skin Score",
    category: "kAI Technology",
    readTime: "3 min",
    imageSrc: "/images/articles/kai-science.png",
    excerpt:
      "Your kAI Skin Score isn't a beauty filter's guess — it's built from measurable parameters tracked over time. Here's what's actually happening behind the scan.",
    sections: [
      {
        heading: "What the score is actually measuring",
        paragraphs: [
          "Each scan analyzes five core parameters — acne, pigmentation, wrinkles, hydration, and texture — and combines them into a single Skin Score, alongside individual grades for each parameter. It's designed to answer one question clearly: is your skin trending better, worse, or steady since your last scan?",
        ],
      },
      {
        heading: "Why a single photo isn't enough",
        paragraphs: [
          "Lighting, angle, and even the camera you're using can all shift how skin looks in a single image. That's why the capture flow guides you through five specific angles for every scan — front, both sides, eyes closed, and smiling — so the model is comparing like-for-like data rather than one flattering (or unflattering) shot.",
        ],
      },
      {
        heading: "Built on Indian skin data",
        paragraphs: [
          "Most publicly available skin-analysis datasets are trained overwhelmingly on lighter skin tones, which makes them noticeably less accurate for a large share of Indian users. kAI's underlying model is trained with an Indian-face-specific dataset, which is part of why pigmentation and tone-related readings tend to hold up better across the range of skin tones we actually see in the clinic.",
        ],
      },
      {
        heading: "Trends matter more than any single number",
        paragraphs: [
          "A single scan is a snapshot; the real value shows up over weeks, as your history builds and the weekly trend line becomes something a doctor can actually act on. That's also why consistent scan angles and lighting matter more than getting a 'perfect' score on any one visit.",
        ],
      },
    ],
  },
  {
    slug: "building-a-skincare-routine-that-works",
    title: "Building a Skincare Routine That Actually Works",
    category: "Routines",
    readTime: "6 min",
    imageSrc: "/images/articles/skincare-routine.png",
    excerpt:
      "More steps isn't a better routine. Here's the minimum that actually moves the needle, and how to know when it's time to add something.",
    sections: [
      {
        heading: "Start smaller than you think",
        paragraphs: [
          "A ten-step routine you abandon in two weeks does less for your skin than a three-step routine you actually stick to. The evidence for consistency mattering more than complexity is strong — most visible improvement comes from a small number of habits repeated daily, not from stacking actives.",
        ],
      },
      {
        heading: "The non-negotiable three",
        paragraphs: [
          "Cleanser, moisturizer, and sunscreen form the base every routine should have before anything else is added. Cleansing removes the day's buildup without stripping skin; moisturizer keeps the skin barrier functioning; sunscreen is, on its own, the single highest-impact step for preventing pigmentation and early ageing — and it's the step most people skip.",
        ],
      },
      {
        heading: "Adding actives without overdoing it",
        paragraphs: [
          "Once the base routine is a genuine daily habit, targeted actives — like a retinoid for texture and fine lines, or a niacinamide serum for oil control and tone — can be layered in one at a time, not all at once. Introducing several new actives simultaneously makes it hard to tell what's working, and increases the risk of irritation.",
        ],
      },
      {
        heading: "Morning vs. evening, briefly",
        paragraphs: [
          "Mornings are about protection: a gentle cleanse, lightweight moisturizer, and sunscreen as the non-negotiable final step. Evenings are about repair: a proper cleanse to remove the day's buildup, then any actives, followed by a slightly richer moisturizer since skin does more of its repair work overnight.",
        ],
      },
      {
        heading: "Letting your data decide what's next",
        paragraphs: [
          "Your Build tab's routine suggestions are generated from your actual scan history, not a generic template — so what's recommended for oily, acne-prone skin will look different from what's recommended for dry, sensitive skin, and it'll keep adjusting as your weekly trends shift.",
        ],
      },
    ],
  },
];

export function getArticleBySlug(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}
