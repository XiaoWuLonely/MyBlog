import { cache } from "react";
import type { ProjectContentFrontmatter } from "./content-shared";
import { normalizeContentSlug } from "./content-slug.js";
import { readContentBySlug, readContentCollectionMeta } from "./content.js";

export type ProjectFrontmatter = ProjectContentFrontmatter;

export type ProjectItem = ProjectFrontmatter;

function normalizeProjectItem(
  project: Partial<ProjectItem> &
    Pick<ProjectItem, "title" | "slug" | "summary" | "date" | "category" | "tags" | "featured" | "assetNames">,
): ProjectItem {
  return {
    ...project,
    description: project.description ?? project.summary,
    year: project.year ?? project.date.slice(0, 4),
    stack: project.stack ?? (project.tags.length > 0 ? project.tags : ["Notes"]),
    icon: project.icon ?? "grid",
    accent: project.accent ?? "primary",
    assetNames: project.assetNames ?? [],
    assetPaths: project.assetPaths ?? [],
  };
}

// React cache：同一请求内去重；元数据瘦身读取避免为列表页拉取全文。
export const getAllProjects = cache(async () => {
  const items = await readContentCollectionMeta<ProjectFrontmatter>({
    category: "project",
  });

  return items
    .map((item) => normalizeProjectItem(item.meta))
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
});

export async function getProjectSlugs() {
  const projects = await getAllProjects();
  return projects.map((project) => project.slug);
}

export async function getProjectBySlug(slug: string) {
  const projects = await getAllProjects();
  const normalizedSlug = normalizeContentSlug(slug);
  return projects.find((project) => project.slug === normalizedSlug) ?? null;
}

export const getProjectDetailBySlug = cache(async (slug: string) => {
  const item = await readContentBySlug<ProjectFrontmatter>({
    category: "project",
    slug,
  });

  if (!item) {
    return null;
  }

  const meta = normalizeProjectItem(item.meta as ProjectItem);

  return {
    meta,
    rawContent: item.content,
  };
});
