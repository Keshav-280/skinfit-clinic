"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock3, NotebookPen } from "lucide-react";
import type { Article, ArticleFigure } from "@/src/lib/articles";

function sectionId(heading: string) {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function CoverImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden bg-gradient-to-br from-[#1E1B31] to-[#242A5F] sm:aspect-[2/1]">
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <NotebookPen
          className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 text-white/25"
          aria-hidden
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#1E1B31]/55 via-[#1E1B31]/10 to-transparent" />
    </div>
  );
}

function FigureGrid({ figures }: { figures: ArticleFigure[] }) {
  const wideLast = figures.length % 2 === 1;
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {figures.map((fig, i) => (
        <article
          key={fig.title}
          className={`rounded-2xl border border-[#E4E6F0] bg-[#FAF8F5] px-4 py-4 ${
            wideLast && i === figures.length - 1 ? "sm:col-span-2" : ""
          }`}
        >
          <h3 className="font-headline text-[17px] font-bold text-[#1E1B31]">
            {fig.title}
          </h3>
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-[#4B4A63]">
            {fig.body}
          </p>
        </article>
      ))}
    </div>
  );
}

function StepList({ steps }: { steps: ArticleFigure[] }) {
  return (
    <ol className="mt-4 space-y-3">
      {steps.map((step, i) => (
        <li
          key={step.title}
          className="flex gap-3 rounded-2xl border border-[#E4E6F0] bg-white px-4 py-3.5"
        >
          <span className="font-meta mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1E1B31] text-[11px] font-bold text-white">
            {String(i + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-[#1E1B31]">{step.title}</p>
            <p className="mt-1 text-[14.5px] leading-relaxed text-[#4B4A63]">
              {step.body}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function ArticleReader({
  article,
  related,
}: {
  article: Article;
  related: Article[];
}) {
  const [progress, setProgress] = useState(0);
  const [activeId, setActiveId] = useState(article.sections[0]?.heading ?? "");

  const toc = useMemo(
    () =>
      article.sections.map((s) => ({
        id: sectionId(s.heading),
        heading: s.heading,
      })),
    [article.sections]
  );

  useEffect(() => {
    const onScroll = () => {
      const el = document.getElementById("article-body");
      if (!el) return;
      const start = el.offsetTop - 96;
      const height = el.scrollHeight - window.innerHeight * 0.45;
      const raw = (window.scrollY - start) / Math.max(height, 1);
      setProgress(Math.min(1, Math.max(0, raw)));

      let current = toc[0]?.id ?? "";
      for (const item of toc) {
        const node = document.getElementById(item.id);
        if (node && node.getBoundingClientRect().top < 160) current = item.id;
      }
      setActiveId(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [toc]);

  return (
    <article className="relative pb-4">
      <div
        className="pointer-events-none sticky top-[3.85rem] z-40 -mx-4 h-0.5 overflow-hidden bg-[#E4E6F0] sm:top-[4.4rem] md:-mx-8"
        aria-hidden
      >
        <div
          className="h-full bg-[#1E1B31] transition-[width] duration-150"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <Link
        href="/dashboard"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#1E1B31] transition hover:text-[#242A5F]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to Build
      </Link>

      <header className="mt-4 overflow-hidden rounded-[22px] border border-[#E4E6F0] bg-white shadow-sm">
        <CoverImage src={article.imageSrc} alt="" />
        <div className="px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-meta inline-flex rounded-full bg-[#F0EAE2] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#1E1B31]">
              {article.category}
            </span>
            <span className="inline-flex items-center gap-1 text-[13px] text-[#6B7280]">
              <Clock3 className="h-3.5 w-3.5" aria-hidden />
              {article.readTime} read
            </span>
          </div>
          <h1 className="font-headline mt-3 text-[1.7rem] font-bold leading-[1.2] tracking-tight text-[#1E1B31] sm:text-3xl md:text-[2.15rem]">
            {article.title}
          </h1>
          <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-[#5B66A1]">
            {article.excerpt}
          </p>
        </div>
      </header>

      <nav
        className="mt-5 flex gap-2 overflow-x-auto pb-1 md:hidden"
        aria-label="In this article"
      >
        {toc.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
              activeId === item.id
                ? "bg-[#1E1B31] text-white"
                : "bg-white text-[#1E1B31] ring-1 ring-[#E4E6F0]"
            }`}
          >
            {item.heading}
          </a>
        ))}
      </nav>

      <div className="mt-6 grid items-start gap-8 lg:grid-cols-[13.5rem_minmax(0,1fr)]">
        <nav
          className="sticky top-24 hidden lg:block"
          aria-label="In this article"
        >
          <p className="font-meta text-[10px] font-bold uppercase tracking-[0.16em] text-[#6B7280]">
            In this article
          </p>
          <ul className="mt-3 space-y-1.5">
            {toc.map((item, i) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className={`block rounded-lg px-2.5 py-1.5 text-[13px] leading-snug transition ${
                    activeId === item.id
                      ? "bg-[#F0EAE2] font-semibold text-[#1E1B31]"
                      : "text-[#6B7280] hover:bg-[#FAF8F5] hover:text-[#1E1B31]"
                  }`}
                >
                  <span className="font-meta mr-1.5 text-[10px] text-[#A8AECD]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {item.heading}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div id="article-body" className="min-w-0 space-y-10">
          {article.sections.map((section, index) => (
            <section
              key={section.heading}
              id={sectionId(section.heading)}
              className="scroll-mt-28"
            >
              <div className="flex items-baseline gap-3">
                <span className="font-meta text-[11px] font-bold tracking-[0.14em] text-[#DF9DA4]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h2 className="font-headline text-xl font-bold tracking-tight text-[#1E1B31] sm:text-[1.35rem]">
                  {section.heading}
                </h2>
              </div>

              {section.paragraphs?.length ? (
                <div className="mt-3 space-y-3">
                  {section.paragraphs.map((p) => (
                    <p
                      key={p.slice(0, 48)}
                      className="text-[16px] leading-[1.75] text-[#2F2C45]"
                    >
                      {p}
                    </p>
                  ))}
                </div>
              ) : null}

              {section.figures?.length ? (
                <FigureGrid figures={section.figures} />
              ) : null}

              {section.steps?.length ? <StepList steps={section.steps} /> : null}

              {section.split ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {section.split.map((side) => (
                    <article
                      key={side.title}
                      className="rounded-2xl border border-[#E4E6F0] bg-[#FAF8F5] px-4 py-4"
                    >
                      <p className="font-meta text-[10px] font-bold uppercase tracking-[0.14em] text-[#5B66A1]">
                        {side.title}
                      </p>
                      <p className="mt-2 text-[14.5px] leading-relaxed text-[#2F2C45]">
                        {side.body}
                      </p>
                    </article>
                  ))}
                </div>
              ) : null}

              {section.after?.length ? (
                <div className="mt-4 space-y-3">
                  {section.after.map((p) => (
                    <p
                      key={p.slice(0, 48)}
                      className="text-[16px] leading-[1.75] text-[#2F2C45]"
                    >
                      {p}
                    </p>
                  ))}
                </div>
              ) : null}

              {section.callout ? (
                <aside className="mt-4 rounded-2xl bg-[#1E1B31] px-5 py-5 text-white shadow-[0_16px_40px_-24px_rgba(30,27,49,0.7)]">
                  <p className="font-meta text-[10px] font-bold uppercase tracking-[0.16em] text-[#DF9DA4]">
                    {section.callout.label}
                  </p>
                  <p className="mt-2 text-[15px] leading-relaxed text-white/90">
                    {section.callout.body}
                  </p>
                </aside>
              ) : null}
            </section>
          ))}
        </div>
      </div>

      {related.length > 0 ? (
        <section className="mt-12 border-t border-[#E4E6F0] pt-8">
          <p className="font-meta text-[11px] font-bold uppercase tracking-[0.14em] text-[#6B7280]">
            Keep reading
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {related.map((item) => (
              <Link
                key={item.slug}
                href={`/dashboard/articles/${item.slug}`}
                className="group overflow-hidden rounded-2xl border border-[#E4E6F0] bg-white transition hover:border-[#1E1B31]/25 hover:shadow-sm"
              >
                <div className="relative aspect-[16/9] bg-gradient-to-br from-[#1E1B31] to-[#242A5F]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageSrc}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
                <div className="px-3.5 py-3">
                  <p className="font-meta text-[10px] font-bold uppercase tracking-[0.12em] text-[#5B66A1]">
                    {item.category} · {item.readTime}
                  </p>
                  <p className="mt-1 text-[14px] font-semibold leading-snug text-[#1E1B31] group-hover:underline">
                    {item.title}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
