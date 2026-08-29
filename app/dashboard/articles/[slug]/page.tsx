import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3 } from "lucide-react";
import { getArticleBySlug } from "@/src/lib/articles";

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1E1B31] transition hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back
      </Link>

      <div className="relative mt-4 aspect-[16/9] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#1E1B31] to-[#242A5F]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={article.imageSrc}
          alt=""
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      </div>

      <div className="mt-5">
        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
          {article.category}
        </span>
        <h1 className="mt-2 text-2xl font-extrabold leading-tight text-[#18181b] md:text-3xl">
          {article.title}
        </h1>
        <div className="mt-2 flex items-center gap-1.5 text-sm text-[#6B7280]">
          <Clock3 className="h-3.5 w-3.5" aria-hidden />
          {article.readTime} read
        </div>
        <p className="mt-4 text-[15px] leading-relaxed text-[#374151]">
          {article.excerpt}
        </p>
      </div>

      <div className="mt-6 space-y-6 border-t border-[#E5E7EB] pt-6">
        {article.sections.map((section) => (
          <div key={section.heading}>
            <h2 className="text-lg font-bold text-[#18181b]">{section.heading}</h2>
            <div className="mt-2 space-y-3">
              {section.paragraphs.map((p, i) => (
                <p key={i} className="text-[15px] leading-relaxed text-[#374151]">
                  {p}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-8 mt-10 border-t border-[#E5E7EB] pt-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1E1B31] transition hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Build
        </Link>
      </div>
    </div>
  );
}
