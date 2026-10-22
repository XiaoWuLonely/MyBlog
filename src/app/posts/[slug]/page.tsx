import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminDeleteButton } from "@/components/site/admin-delete-button";
import { DetailBackLink, DetailPageShell, DetailRelatedSection } from "@/components/site/detail-shell";
import { MarkdownContent } from "@/components/site/markdown-content";
import { isAdminRequest } from "@/lib/admin-auth-server";
import { getCachedAdjacentPosts, getCachedPostBySlug } from "@/lib/cached-content";
import { buildDetailMetaChips, resolveDetailSummary } from "@/lib/detail-shell";
import { buildEditorLoadHref } from "@/lib/editor";
import { buildArchiveHref, type ArchiveFilters } from "@/lib/posts-shared";
import { getPostSlugs } from "@/lib/posts";
import { formatDate } from "@/lib/utils";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<ArchiveFilters>;
};

export async function generateStaticParams() {
  const slugs = await getPostSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getCachedPostBySlug(slug).catch(() => null);

  if (!post) {
    return {};
  }

  const summary = resolveDetailSummary(post.meta.summary);

  return {
    title: post.meta.title,
    description: summary,
    openGraph: {
      title: post.meta.title,
      description: summary,
      type: "article",
    },
  };
}

// 返回链接依赖 searchParams（运行时数据），放入 Suspense 动态洞以保持页面外壳可缓存。
async function ArchiveBackLink({ searchParams }: { searchParams: Promise<ArchiveFilters> }) {
  const filters = await searchParams;
  return <DetailBackLink href={buildArchiveHref(filters)} preserveScroll label="返回归档" transitionKey="back-archive" />;
}

// 管理员的编辑/删除入口需要读 cookies，同样放入 Suspense 动态洞。
async function PostAdminActions({ slug, searchParams }: { slug: string; searchParams: Promise<ArchiveFilters> }) {
  if (!(await isAdminRequest())) {
    return null;
  }

  const filters = await searchParams;

  return (
    <>
      <DetailBackLink href={buildEditorLoadHref("archive", slug)} label="编辑" transitionKey={`post-edit-${slug}`} />
      <AdminDeleteButton category="archive" slug={slug} redirectHref={buildArchiveHref(filters)} variant="inline">
        删除
      </AdminDeleteButton>
    </>
  );
}

export default async function PostPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const post = await getCachedPostBySlug(slug).catch(() => null);

  if (!post) {
    notFound();
  }

  const adjacent = await getCachedAdjacentPosts(slug);
  const summary = resolveDetailSummary(post.meta.summary);
  const relatedItems = [adjacent.previous, adjacent.next]
    .filter((item): item is NonNullable<typeof adjacent.previous> => item !== null)
    .map((item) => ({
      title: item.title,
      summary: item.summary,
      href: `/posts/${item.slug}`,
      transitionKey: `post-${item.slug}`,
      meta: item.readingMinutes,
    }));

  return (
    <DetailPageShell
      backLink={
        <div className="flex flex-wrap items-center gap-3">
          <Suspense
            fallback={<DetailBackLink href="/archive" preserveScroll label="返回归档" transitionKey="back-archive" />}
          >
            <ArchiveBackLink searchParams={searchParams} />
          </Suspense>
          <Suspense fallback={null}>
            <PostAdminActions slug={post.meta.slug} searchParams={searchParams} />
          </Suspense>
        </div>
      }
      eyebrow={
        <>
          <span className="resource-detail-chip-dot" aria-hidden="true" />
          {post.meta.category}
        </>
      }
      title={post.meta.title}
      summary={<p>{summary}</p>}
      metaChips={buildDetailMetaChips([formatDate(post.meta.date), post.meta.readingMinutes, ...post.meta.tags])}
      body={<MarkdownContent source={post.rawContent} />}
      related={<DetailRelatedSection title="继续阅读" items={relatedItems} />}
    />
  );
}
