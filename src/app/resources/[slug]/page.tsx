import type { Metadata } from "next";
import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminDeleteButton } from "@/components/site/admin-delete-button";
import {
  DetailAttachmentsSection,
  DetailBackLink,
  DetailHeroActions,
  DetailPageShell,
  DetailRelatedSection,
} from "@/components/site/detail-shell";
import { isAdminRequest } from "@/lib/admin-auth-server";
import { getCachedRelatedResources, getCachedResourceDetailBySlug } from "@/lib/cached-content";
import { buildDetailAttachmentItems, buildDetailMetaChips, resolveDetailSummary } from "@/lib/detail-shell";
import { buildEditorLoadHref } from "@/lib/editor";
import { buildResourcesHref, buildResourceDetailHref, type ResourceFilters } from "@/lib/resources-shared";
import { getResourceSlugs } from "@/lib/resources";
import { ResourceDetailContent } from "../resource-detail-content";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<ResourceFilters>;
};

// Cache Components 要求 generateStaticParams 至少返回一个样本参数。
// 内容只存在云端 D1，若校验/构建期枚举不到（如本地 dev 拿不到 D1 上下文），
// 退回占位 slug 交给页面 notFound()，真实页面在请求时按需渲染。
export async function generateStaticParams() {
  const slugs = await getResourceSlugs();
  return (slugs.length > 0 ? slugs : ["__placeholder__"]).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const resource = await getCachedResourceDetailBySlug(slug);

  if (!resource) {
    return {};
  }

  const summary = resolveDetailSummary(resource.meta.summary, resource.meta.description);

  return {
    title: resource.meta.title,
    description: summary,
  };
}

// 返回链接依赖 searchParams（运行时数据），放入 Suspense 动态洞以保持页面外壳可缓存。
async function ResourcesBackLink({ searchParams }: { searchParams: Promise<ResourceFilters> }) {
  const filters = await searchParams;
  return <DetailBackLink href={buildResourcesHref(filters)} preserveScroll label="返回资源列表" transitionKey="resource-back" />;
}

// 管理员的编辑/删除入口需要读 cookies，同样放入 Suspense 动态洞。
async function ResourceAdminActions({ slug, searchParams }: { slug: string; searchParams: Promise<ResourceFilters> }) {
  if (!(await isAdminRequest())) {
    return null;
  }

  const filters = await searchParams;

  return (
    <>
      <DetailBackLink href={buildEditorLoadHref("resource", slug)} label="编辑" transitionKey={`resource-edit-${slug}`} />
      <AdminDeleteButton category="resource" slug={slug} redirectHref={buildResourcesHref(filters)} variant="inline">
        删除
      </AdminDeleteButton>
    </>
  );
}

// 相关资源的链接保留当前筛选参数，searchParams 仅在洞内读取。
async function ResourceRelatedSection({ slug, searchParams }: { slug: string; searchParams: Promise<ResourceFilters> }) {
  const [filters, related] = await Promise.all([searchParams, getCachedRelatedResources(slug, 3)]);

  return (
    <DetailRelatedSection
      title="相关资源"
      items={related.map((item) => ({
        title: item.title,
        summary: resolveDetailSummary(item.summary, item.description),
        href: buildResourceDetailHref(item.slug, filters),
        transitionKey: `resource-${item.slug}`,
        meta: item.category,
      }))}
    />
  );
}

export default async function ResourceDetailPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const resource = await getCachedResourceDetailBySlug(slug);

  if (!resource) {
    notFound();
  }

  const summary = resolveDetailSummary(resource.meta.summary, resource.meta.description);

  return (
    <DetailPageShell
      backLink={
        <div className="flex flex-wrap items-center gap-3">
          <Suspense
            fallback={<DetailBackLink href="/resources" preserveScroll label="返回资源列表" transitionKey="resource-back" />}
          >
            <ResourcesBackLink searchParams={searchParams} />
          </Suspense>
          <Suspense fallback={null}>
            <ResourceAdminActions slug={resource.meta.slug} searchParams={searchParams} />
          </Suspense>
        </div>
      }
      eyebrow={
        <>
          <span className="resource-detail-chip-dot" aria-hidden="true" />
          {resource.meta.category}
        </>
      }
      title={resource.meta.title}
      summary={<p>{summary}</p>}
      cover={
        resource.meta.cover ? (
          <div className="theme-surface overflow-hidden rounded-[28px] p-2 shadow-[var(--shadow-far)]">
            <Image
              src={resource.meta.cover}
              alt={resource.meta.title}
              width={1600}
              height={900}
              className="h-auto w-full rounded-[22px] object-cover"
              sizes="(min-width: 1280px) 900px, 100vw"
            />
          </div>
        ) : null
      }
      metaChips={buildDetailMetaChips([resource.meta.category, `${resource.meta.rating}.0 / 5`, ...resource.meta.tags])}
      actions={
        resource.meta.url ? (
          <DetailHeroActions
            items={[
              {
                label: "打开原始资源",
                href: resource.meta.url,
                variant: "primary",
                icon: <ExternalLink className="h-4 w-4" />,
              },
            ]}
          />
        ) : null
      }
      body={<ResourceDetailContent source={resource.rawContent} />}
      attachments={
        <DetailAttachmentsSection
          title="资源附件"
          items={buildDetailAttachmentItems(resource.meta.assetNames, resource.meta.assetPaths)}
        />
      }
      related={
        <Suspense fallback={null}>
          <ResourceRelatedSection slug={resource.meta.slug} searchParams={searchParams} />
        </Suspense>
      }
    />
  );
}
