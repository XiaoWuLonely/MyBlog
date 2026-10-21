import type { Metadata } from "next";
import Image from "next/image";
import { GitBranch } from "lucide-react";
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
import { getCachedAllProjects, getCachedProjectDetailBySlug } from "@/lib/cached-content";
import { buildDetailAttachmentItems, buildDetailMetaChips, resolveDetailSummary } from "@/lib/detail-shell";
import { buildEditorLoadHref } from "@/lib/editor";
import { getProjectSlugs } from "@/lib/projects";
import { formatDate } from "@/lib/utils";
import { ProjectDetailContent } from "../project-detail-content";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const slugs = await getProjectSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = await getCachedProjectDetailBySlug(slug);

  if (!project) {
    return {};
  }

  const summary = resolveDetailSummary(project.meta.summary, project.meta.description);

  return {
    title: project.meta.title,
    description: summary,
  };
}

// 管理员的编辑/删除入口需要读 cookies，放入 Suspense 动态洞以保持页面外壳可缓存。
async function ProjectDetailAdminActions({ slug }: { slug: string }) {
  if (!(await isAdminRequest())) {
    return null;
  }

  return (
    <>
      <DetailBackLink href={buildEditorLoadHref("project", slug)} label="编辑" transitionKey={`project-edit-${slug}`} />
      <AdminDeleteButton category="project" slug={slug} redirectHref="/projects" variant="inline">
        删除
      </AdminDeleteButton>
    </>
  );
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const project = await getCachedProjectDetailBySlug(slug);

  if (!project) {
    notFound();
  }

  const allProjects = await getCachedAllProjects();
  const summary = resolveDetailSummary(project.meta.summary, project.meta.description);
  const related = allProjects.filter((item) => item.slug !== slug).slice(0, 3);

  return (
    <DetailPageShell
      backLink={
        <div className="flex flex-wrap items-center gap-3">
          <DetailBackLink href="/projects" label="返回项目列表" transitionKey="project-back" />
          <Suspense fallback={null}>
            <ProjectDetailAdminActions slug={project.meta.slug} />
          </Suspense>
        </div>
      }
      eyebrow={
        <>
          <span className="resource-detail-chip-dot" aria-hidden="true" />
          {project.meta.category}
        </>
      }
      title={project.meta.title}
      summary={<p>{summary}</p>}
      cover={
        project.meta.cover ? (
          <div className="theme-surface overflow-hidden rounded-[28px] p-2 shadow-[var(--shadow-far)]">
            <Image
              src={project.meta.cover}
              alt={project.meta.title}
              width={1600}
              height={900}
              className="h-auto w-full rounded-[22px] object-cover"
              sizes="(min-width: 1280px) 900px, 100vw"
            />
          </div>
        ) : null
      }
      metaChips={buildDetailMetaChips([
        project.meta.year,
        formatDate(project.meta.date),
        ...project.meta.stack,
        ...project.meta.tags,
      ])}
      actions={
        <DetailHeroActions
          items={[
            ...(project.meta.href ? [{ label: "Website", href: project.meta.href, variant: "primary" as const }] : []),
            ...(project.meta.github
              ? [
                  {
                    label: "GitHub",
                    href: project.meta.github,
                    variant: "secondary" as const,
                    icon: <GitBranch className="h-4 w-4" />,
                  },
                ]
              : []),
            ...(project.meta.docs ? [{ label: "Docs", href: project.meta.docs, variant: "secondary" as const }] : []),
          ]}
        />
      }
      body={<ProjectDetailContent source={project.rawContent} />}
      attachments={
        <DetailAttachmentsSection
          title="项目附件"
          items={buildDetailAttachmentItems(project.meta.assetNames, project.meta.assetPaths)}
        />
      }
      related={
        <DetailRelatedSection
          title="更多项目"
          items={related.map((item) => ({
            title: item.title,
            summary: resolveDetailSummary(item.summary, item.description),
            href: `/projects/${item.slug}`,
            transitionKey: `project-${item.slug}`,
            meta: item.year,
          }))}
        />
      }
    />
  );
}
