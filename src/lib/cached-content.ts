import { cacheLife, cacheTag } from "next/cache";
import { getAdjacentPosts, getAllPosts, getPostBySlug } from "./posts";
import { getAllProjects, getProjectDetailBySlug } from "./projects";
import {
  getAllResources,
  getRelatedResources,
  getResourceCategories,
  getResourceDetailBySlug,
} from "./resources";

// 公开页面的跨请求缓存入口（Next "use cache"，落 KV incremental cache）。
// 仅 app 公开页面使用；编辑器 / 测试链路继续调用 posts/projects/resources 的原始 getter，
// 以保证实时性（cacheTag/cacheLife 在非 Next 环境会抛错，不能放进原始 getter）。
// 失效：编辑器发布/删除时对对应类目调用 revalidateTag("content:<category>")。

const CONTENT_CACHE_LIFE = { revalidate: 300, expire: 3600 } as const;

export async function getCachedAllPosts() {
  "use cache";
  cacheLife(CONTENT_CACHE_LIFE);
  cacheTag("content:archive");
  return getAllPosts();
}

export async function getCachedPostBySlug(slug: string) {
  "use cache";
  cacheLife(CONTENT_CACHE_LIFE);
  cacheTag("content:archive", `content:archive:${slug}`);
  return getPostBySlug(slug);
}

export async function getCachedAdjacentPosts(slug: string) {
  "use cache";
  cacheLife(CONTENT_CACHE_LIFE);
  cacheTag("content:archive", `content:archive:${slug}`);
  return getAdjacentPosts(slug);
}

export async function getCachedAllProjects() {
  "use cache";
  cacheLife(CONTENT_CACHE_LIFE);
  cacheTag("content:project");
  return getAllProjects();
}

export async function getCachedProjectDetailBySlug(slug: string) {
  "use cache";
  cacheLife(CONTENT_CACHE_LIFE);
  cacheTag("content:project", `content:project:${slug}`);
  return getProjectDetailBySlug(slug);
}

export async function getCachedAllResources() {
  "use cache";
  cacheLife(CONTENT_CACHE_LIFE);
  cacheTag("content:resource");
  return getAllResources();
}

export async function getCachedResourceCategories() {
  "use cache";
  cacheLife(CONTENT_CACHE_LIFE);
  cacheTag("content:resource");
  return getResourceCategories();
}

export async function getCachedResourceDetailBySlug(slug: string) {
  "use cache";
  cacheLife(CONTENT_CACHE_LIFE);
  cacheTag("content:resource", `content:resource:${slug}`);
  return getResourceDetailBySlug(slug);
}

export async function getCachedRelatedResources(slug: string, limit = 3) {
  "use cache";
  cacheLife(CONTENT_CACHE_LIFE);
  cacheTag("content:resource", `content:resource:${slug}`);
  return getRelatedResources(slug, limit);
}
