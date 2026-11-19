import { notFound } from "next/navigation";
import { GuidePage } from "@/components/pages/guide-page";
import { ARTICLES, findArticle } from "@/data/blog";
import { pageMetadata } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return ARTICLES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = findArticle(slug);
  if (!post) return {};
  return pageMetadata({ title: post.metaTitle, description: post.metaDescription, path: post.path });
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = findArticle(slug);
  if (!post) notFound();
  return <GuidePage guide={post} />;
}
