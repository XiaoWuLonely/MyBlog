import path from "node:path";
import { cache } from "react";
import matter from "gray-matter";
import type { ProjectContentFrontmatter } from "./content-shared";
import { findContentFileBySlug, normalizeContentSlug } from "./content-slug.js";
import { readCollectionItems, readContentBySlugWithD1Fallback, readContentCollectionMetaWithD1Fallback } from "./content.js";

const PROJECTS_DIR = path.join(process.cwd(), "src", "content", "projects");

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
  const items = await readContentCollectionMetaWithD1Fallback<ProjectFrontmatter>({
    category: "project",
    fallback: async () =>
      (await readCollectionItems<ProjectFrontmatter>(PROJECTS_DIR)).map(({ meta, filePath }) => ({
        meta,
        filePath,
      })),
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
  const item = await readContentBySlugWithD1Fallback<ProjectFrontmatter>({
    category: "project",
    slug,
    fallback: async () => {
      const match = await findContentFileBySlug(PROJECTS_DIR, slug);

      if (!match) {
        return null;
      }

      const { data, content } = matter(match.source);
      return {
        meta: data as ProjectFrontmatter,
        content,
        filePath: match.filePath,
      };
    },
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
