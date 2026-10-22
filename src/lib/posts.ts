import fs from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import matter from "gray-matter";
import readingTime from "reading-time";
import type { BaseContentFrontmatter } from "./content-shared";
import { findContentFileBySlug, normalizeContentSlug } from "./content-slug.js";
import {
  readCollectionItems,
  readContentBySlugWithD1Fallback,
  readContentCollectionMetaWithD1Fallback,
} from "./content.js";
import { getStaticContentEntries } from "./static-content.js";

const POSTS_DIR = path.join(process.cwd(), "src", "content", "posts");

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
  const files = await fs.readdir(POSTS_DIR).catch(() => getStaticContentEntries(POSTS_DIR).map((entry) => entry.fileName));
  return files.filter((file) => file.endsWith(".mdx")).map((file) => file.replace(/\.mdx$/, ""));
}

// React cache：同一请求内（generateMetadata / 页面 / 相邻文章）去重，避免重复 D1 查询。
export const getAllPosts = cache(async () => {
  const items = await readContentCollectionMetaWithD1Fallback<PostFrontmatter>({
    category: "archive",
    fallback: async () =>
      (await readCollectionItems<PostFrontmatter>(POSTS_DIR)).map(({ meta, filePath }) => ({
        meta,
        filePath,
      })),
  });

  return items
    .map((item): PostMeta => ({ ...item.meta }))
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
});

export async function getFeaturedPosts(limit = 3) {
  const posts = await getAllPosts();
  return posts.filter((post) => post.featured).slice(0, limit);
}

export async function getPostMeta(slug: string) {
  try {
    const match = await findContentFileBySlug(POSTS_DIR, slug);
    if (!match) {
      return null;
    }
    const source = match.source;
    const { data, content } = matter(source);
    const stats = readingTime(content);

    return {
      ...(data as PostFrontmatter),
      slug: normalizeContentSlug(slug),
      readingMinutes: `${Math.max(1, Math.ceil(stats.minutes))} min read`,
    } satisfies PostMeta;
  } catch {
    return null;
  }
}

export const getPostBySlug = cache(async (slug: string) => {
  const item = await readContentBySlugWithD1Fallback<PostFrontmatter>({
    category: "archive",
    slug,
    fallback: async () => {
      const match = await findContentFileBySlug(POSTS_DIR, slug);

      if (!match) {
        return null;
      }

      const { data, content } = matter(match.source);
      return {
        meta: data as PostFrontmatter,
        content,
        filePath: match.filePath,
      };
    },
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
