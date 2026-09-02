import { notFound } from "next/navigation";
import { ArticleReader } from "@/components/dashboard/ArticleReader";
import {
  ARTICLES,
  getArticleBySlug,
  getRelatedArticles,
} from "@/src/lib/articles";

export function generateStaticParams() {
  return ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return { title: "Article" };
  return {
    title: `${article.title} · SkinFit Wellness`,
    description: article.excerpt,
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  return (
    <div className="mx-auto max-w-5xl">
      <ArticleReader article={article} related={getRelatedArticles(article.slug)} />
    </div>
  );
}
