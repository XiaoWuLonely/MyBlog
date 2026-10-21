import path from "node:path";
import { cache } from "react";
import matter from "gray-matter";
import { findContentFileBySlug, normalizeContentSlug } from "./content-slug.js";
import { readCollectionItems, readContentBySlugWithD1Fallback, readContentCollectionMetaWithD1Fallback } from "./content.js";
import {
  ALL_RESOURCES_CATEGORY,
  normalizeResourceFiltersWithCategories,
  type ResourceFilters,
  type ResourceItem,
} from "./resources-shared.js";
const RESOURCES_DIR = path.join(process.cwd(), "src", "content", "resources");

function createResourceMonogram(title: string) {
  const parts = title
    .split(/[\s-]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const letters = parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return letters || title.slice(0, 2).toUpperCase() || "NT";
}

function normalizeResourceItem(resource: Partial<ResourceItem> & Pick<ResourceItem, "title" | "slug" | "summary" | "date" | "category" | "tags" | "featured" | "assetNames">): ResourceItem {
  return {
    ...resource,
    description: resource.description ?? resource.summary,
    url: resource.url ?? `/resources/${resource.slug}`,
    rating: resource.rating ?? 4,
    accent: resource.accent ?? "primary",
    monogram: resource.monogram ?? createResourceMonogram(resource.title),
    assetNames: resource.assetNames ?? [],
    assetPaths: resource.assetPaths ?? [],
  };
}

// React cache：同一请求内去重；元数据瘦身读取避免为列表页拉取全文。
export const getAllResources = cache(async () => {
  const items = await readContentCollectionMetaWithD1Fallback<ResourceItem>({
    category: "resource",
    fallback: async () =>
      (await readCollectionItems<ResourceItem>(RESOURCES_DIR)).map(({ meta, filePath }) => ({
        meta,
        filePath,
      })),
  });

  return items
    .map((item) => normalizeResourceItem(item.meta))
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
});

export async function getResourceSlugs() {
  const resources = await getAllResources();
  return resources.map((resource) => resource.slug);
}

export async function getResourceBySlug(slug: string) {
  const resources = await getAllResources();
  const normalizedSlug = normalizeContentSlug(slug);
  return resources.find((resource) => resource.slug === normalizedSlug) ?? null;
}

export const getResourceDetailBySlug = cache(async (slug: string) => {
  const item = await readContentBySlugWithD1Fallback<ResourceItem>({
    category: "resource",
    slug,
    fallback: async () => {
      const match = await findContentFileBySlug(RESOURCES_DIR, slug);

      if (!match) {
        return null;
      }

      const { data, content } = matter(match.source);
      return {
        meta: data as ResourceItem,
        content,
        filePath: match.filePath,
      };
    },
  });

  if (!item) {
    return null;
  }

  const meta = normalizeResourceItem(item.meta as ResourceItem);

  return {
    meta,
    rawContent: item.content,
  };
});

export async function getResourceCategories() {
  const resources = await getAllResources();
  return [ALL_RESOURCES_CATEGORY, ...new Set(resources.map((resource) => resource.category))];
}

export async function filterResources(filters: ResourceFilters) {
  const resources = await getAllResources();
  const categories = await getResourceCategories();
  const { q, category } = normalizeResourceFiltersWithCategories(filters, categories);
  const normalized = q.toLowerCase();

  return resources.filter((resource) => {
    const matchCategory = category === ALL_RESOURCES_CATEGORY || resource.category === category;
    const haystack = `${resource.title} ${resource.description} ${resource.tags.join(" ")}`.toLowerCase();
    const matchQuery = !normalized || haystack.includes(normalized);

    return matchCategory && matchQuery;
  });
}

export async function getRelatedResources(slug: string, limit = 3) {
  const current = await getResourceBySlug(slug);

  if (!current) {
    return [] as ResourceItem[];
  }

  const resources = await getAllResources();
  const sameCategory = resources.filter(
    (resource) => resource.slug !== slug && resource.category === current.category,
  );
  const remainder = resources.filter(
    (resource) => resource.slug !== slug && resource.category !== current.category,
  );

  return [...sameCategory, ...remainder].slice(0, limit);
}
