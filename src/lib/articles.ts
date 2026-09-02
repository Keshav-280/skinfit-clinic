export type ArticleFigure = {
  title: string;
  body: string;
};

export type ArticleSection = {
  heading: string;
  paragraphs?: string[];
  figures?: ArticleFigure[];
  steps?: ArticleFigure[];
  split?: [ArticleFigure, ArticleFigure];
  after?: string[];
  callout?: { label: string; body: string };
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
      "Every product recommendation assumes you know your skin type. Here's how to actually know — and why a one-time guess rarely holds up.",
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
        figures: [
          {
            title: "Oily",
            body: "Produces more sebum than it needs, showing up as shine, enlarged pores, and a tendency toward breakouts — especially around the T-zone.",
          },
          {
            title: "Dry",
            body: "Doesn't produce enough natural oil, leading to tightness, flaking, and sometimes a dull or rough texture, particularly after cleansing.",
          },
          {
            title: "Combination",
            body: "Oily in some areas (usually forehead, nose, chin) and normal-to-dry in others (cheeks) — the most common type, and often the most confusing to shop for.",
          },
          {
            title: "Normal",
            body: "Well-balanced: not too oily, not too dry, with a fairly even texture and few sensitivities.",
          },
          {
            title: "Sensitive",
            body: "Reacts easily — redness, stinging, or irritation from products, weather, or fabrics — and can overlap with any of the four types above.",
          },
        ],
      },
      {
        heading: "A simple way to check at home",
        steps: [
          {
            title: "Cleanse",
            body: "Wash your face with a gentle cleanser and don't apply anything after.",
          },
          {
            title: "Wait 30 minutes",
            body: "No products, no touching — just give your skin time to settle into its natural state.",
          },
          {
            title: "Read the signs",
            body: "In good light: shine across your whole face usually means oily, tightness or flaking means dry, shine only on the T-zone means combination, and no real change either way usually means normal.",
          },
        ],
        after: [
          "This test is a decent starting point, but it doesn't account for the deeper patterns a proper scan can pick up — pore size, hydration levels beneath the surface, and how your skin is actually behaving over time rather than in one 30-minute window.",
        ],
      },
      {
        heading: "Where kAI fits in",
        callout: {
          label: "On your Build tab",
          body: "Your kAI scan measures skin type alongside acne, pigmentation, wrinkles, hydration, and texture — so instead of a guess, you get a reading that's tracked scan over scan. That's what powers the personalized routine suggestions you see on your Build tab.",
        },
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
      "Humidity, UV, and city pollution don't show up in generic skincare advice. Here's what actually changes for Indian skin across the year.",
    sections: [
      {
        heading: "One country, several very different climates",
        paragraphs: [
          "Skincare advice written for temperate, low-humidity climates often doesn't translate well to Indian conditions. High humidity for months at a time, intense UV exposure near the equator, and heavy air pollution in many cities all place specific, compounding demands on skin.",
        ],
      },
      {
        heading: "How the year actually feels on skin",
        figures: [
          {
            title: "Summer",
            body: "Prolonged heat increases sweat and sebum production, which can trigger breakouts and clogged pores even in people who don't normally struggle with acne. India's UV index also runs high for much of the year, accelerating pigmentation and early signs of ageing if sunscreen isn't a daily habit — not just an occasional one.",
          },
          {
            title: "Monsoon",
            body: "Humidity keeps skin from drying out, but it also creates ideal conditions for fungal and bacterial breakouts, especially with sweat and pollution sitting on the skin for longer. Lightweight, non-comedogenic products tend to work better than rich creams during this stretch.",
          },
          {
            title: "Winter & pollution",
            body: "Even in warmer regions, winter air tends to be drier, and in many Indian cities it also carries significantly more particulate pollution. That combination shows up as dullness, dehydration, and a rougher texture that sunscreen and moisturizer alone don't fully address; a proper cleanse each evening matters more this season than most people realize.",
          },
        ],
      },
      {
        heading: "Adjusting instead of guessing",
        callout: {
          label: "Weekly check-in",
          body: "The core lesson isn't to buy more products — it's to adjust the same routine's weight and frequency with the season. kAI's weekly check-in factors in your city and the season when it reviews your scan trends, which is why routine suggestions sometimes shift even when your underlying skin type hasn't changed.",
        },
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
      "The score isn't a beauty filter. It's five measurable parameters, captured from three angles, tracked over time.",
    sections: [
      {
        heading: "What the score is actually measuring",
        paragraphs: [
          "Each scan analyzes five core parameters and combines them into a single Skin Score, alongside individual grades for each parameter. It's designed to answer one question clearly: is your skin trending better, worse, or steady since your last scan?",
        ],
        figures: [
          { title: "Acne", body: "Active breakouts and how they're clustering." },
          { title: "Pigmentation", body: "Tone unevenness across the face." },
          { title: "Wrinkles", body: "Fine lines and deeper expression marks." },
          { title: "Hydration", body: "Surface dryness versus a supported barrier." },
          { title: "Texture", body: "Smoothness, roughness, and pore appearance." },
        ],
      },
      {
        heading: "Why a single photo isn't enough",
        paragraphs: [
          "Lighting, angle, and even the camera you're using can all shift how skin looks in a single image. That's why the capture flow guides you through three specific angles for every scan — front and both sides — so the model is comparing like-for-like data rather than one flattering (or unflattering) shot.",
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
        callout: {
          label: "Scan over scan",
          body: "A single scan is a snapshot; the real value shows up over weeks, as your history builds and the weekly trend line becomes something a doctor can actually act on. That's also why consistent scan angles and lighting matter more than getting a “perfect” score on any one visit.",
        },
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
      "A ten-step routine you abandon in two weeks does less than a three-step routine you actually stick to. Start here.",
    sections: [
      {
        heading: "Start smaller than you think",
        paragraphs: [
          "A ten-step routine you abandon in two weeks does less for your skin than a three-step routine you actually stick to. The evidence for consistency mattering more than complexity is strong — most visible improvement comes from a small number of habits repeated daily, not from stacking actives.",
        ],
      },
      {
        heading: "The non-negotiable three",
        figures: [
          {
            title: "Cleanser",
            body: "Removes the day's buildup without stripping skin — the reset every routine starts from.",
          },
          {
            title: "Moisturizer",
            body: "Keeps the skin barrier functioning so everything else you apply has a chance to work.",
          },
          {
            title: "Sunscreen",
            body: "On its own, the single highest-impact step for preventing pigmentation and early ageing — and the step most people skip.",
          },
        ],
        after: [
          "These three form the base every routine should have before anything else is added.",
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
        split: [
          {
            title: "Morning — protect",
            body: "A gentle cleanse, lightweight moisturizer, and sunscreen as the non-negotiable final step.",
          },
          {
            title: "Evening — repair",
            body: "A proper cleanse to remove the day's buildup, then any actives, followed by a slightly richer moisturizer since skin does more of its repair work overnight.",
          },
        ],
      },
      {
        heading: "Letting your data decide what's next",
        callout: {
          label: "Personalized on Build",
          body: "Your Build tab's routine suggestions are generated from your actual scan history, not a generic template — so what's recommended for oily, acne-prone skin will look different from what's recommended for dry, sensitive skin, and it'll keep adjusting as your weekly trends shift.",
        },
      },
    ],
  },
];

export function getArticleBySlug(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

export function getRelatedArticles(slug: string, limit = 3): Article[] {
  return ARTICLES.filter((a) => a.slug !== slug).slice(0, limit);
}
