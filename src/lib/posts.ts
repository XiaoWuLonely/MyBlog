import { cache } from "react";
import readingTime from "reading-time";
import type { BaseContentFrontmatter } from "./content-shared";
import { normalizeContentSlug } from "./content-slug.js";
import {
  readContentBySlug,
  readContentCollectionMeta,
} from "./content.js";

export type PostFrontmatter = BaseContentFrontmatter & {
  title: string;
  slug: string;
  summary: string;
  date: string;
  category: string;
  tags: string[];
  cover?: string;
  featured?: boolean;
};

export type PostMeta = PostFrontmatter & {
  // 列表场景不再逐篇计算阅读时长（需读全文，成本高）；仅详情页提供。
  readingMinutes?: string;
};

export async function getPostSlugs() {
  const posts = await getAllPosts();
  return posts.map((post) => post.slug);
}

// React cache：同一请求内（generateMetadata / 页面 / 相邻文章）去重，避免重复 D1 查询。
export const getAllPosts = cache(async () => {
  const items = await readContentCollectionMeta<PostFrontmatter>({
    category: "archive",
  });

  return items
    .map((item): PostMeta => ({ ...item.meta }))
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
});

export async function getFeaturedPosts(limit = 3) {
  const posts = await getAllPosts();
  return posts.filter((post) => post.featured).slice(0, limit);
}

export const getPostBySlug = cache(async (slug: string) => {
  const item = await readContentBySlug<PostFrontmatter>({
    category: "archive",
    slug,
  });

  if (!item) {
    throw new Error(`Post not found for slug: ${slug}`);
  }
  const normalizedSlug = normalizeContentSlug(slug);

  return {
    meta: {
      ...item.meta,
      slug: normalizedSlug,
      readingMinutes: `${Math.max(1, Math.ceil(readingTime(item.content).minutes))} min read`,
    } satisfies PostMeta,
    rawContent: item.content,
  };
});

export async function getAdjacentPosts(slug: string) {
  const posts = await getAllPosts();
  const currentIndex = posts.findIndex((post) => post.slug === slug);

  if (currentIndex === -1) {
    return { previous: null, next: null };
  }

  return {
    previous: posts[currentIndex + 1] ?? null,
    next: posts[currentIndex - 1] ?? null,
  };
}
