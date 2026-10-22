import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import type {
  BaseContentFrontmatter,
  ProjectContentFrontmatter,
  ResourceContentFrontmatter,
} from "./content-shared";
import { normalizeContentSlug } from "./content-slug.js";
import type { EditorCategory, EditorDraft, EditorDraftSource } from "./editor-shared";
import {
  buildAttachmentAssetReference,
  buildCoverAssetReference,
  createEmptyEditorDraft,
  type EditorSubmitPayload,
  prepareEditorSubmitPayload,
} from "./editor.js";
import type { EditorWriteResult } from "./publish-shared";
import { getD1Binding, type D1DatabaseBinding } from "./cloudflare-bindings.js";
import {
  getD1ContentBySlug,
  hasD1ContentRow,
  listAllD1Content,
  listAllD1ContentMeta,
} from "./cloudflare-content-store.js";
import { readThroughD1Cache } from "./d1-cache.js";

export const CONTENT_CATEGORY_DIRECTORY = {
  archive: "posts",
  project: "projects",
  resource: "resources",
} as const satisfies Record<EditorCategory, string>;

export type ContentDirectory = (typeof CONTENT_CATEGORY_DIRECTORY)[EditorCategory];

export type ContentCollectionItem<T extends BaseContentFrontmatter = BaseContentFrontmatter> = {
  meta: T;
  content: string;
  filePath: string;
};

// 列表场景专用的元数据形态：不含正文，避免为列表页解析 / 传输整篇内容。
export type ContentCollectionMeta<T extends BaseContentFrontmatter = BaseContentFrontmatter> = {
  meta: T;
  filePath: string;
};

export type EditorWritePayload = EditorSubmitPayload;

export type EditorUploadedFile = {
  name: string;
  type: string;
  size: number;
  buffer: Uint8Array;
};

type PersistedEditorAssets = {
  coverPath: string | null;
  assetEntries: Array<{
    name: string;
    path: string | null;
  }>;
};

export type PersistedEditorDraftResult = {
  draft: EditorDraft;
  source: EditorDraftSource;
};

const CATEGORY_LABELS: Record<EditorCategory, string> = {
  archive: "归档",
  project: "项目",
  resource: "资源",
};

function createMonogram(title: string) {
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

function createResourceFrontmatter(
  payload: EditorWritePayload,
  base: BaseContentFrontmatter,
): ResourceContentFrontmatter {
  return {
    ...base,
    url: payload.resourceMeta.url || `/resources/${payload.slug}`,
    rating: payload.resourceMeta.rating,
    accent: payload.resourceMeta.accent,
    monogram: payload.resourceMeta.monogram || createMonogram(payload.title),
  };
}

function createProjectFrontmatter(
  payload: EditorWritePayload,
  base: BaseContentFrontmatter,
  now: () => string = () => new Date().toISOString(),
): ProjectContentFrontmatter {
  return {
    ...base,
    year: payload.projectMeta.year || resolvePublishDate(payload.scheduleAt, now).slice(0, 4),
    stack: payload.projectMeta.stack.length > 0 ? payload.projectMeta.stack : payload.tags.length > 0 ? payload.tags : ["Notes"],
    href: payload.projectMeta.href || undefined,
    github: payload.projectMeta.github || undefined,
    docs: payload.projectMeta.docs || undefined,
    icon: payload.projectMeta.icon,
    accent: payload.projectMeta.accent,
  };
}

export function getContentDirectoryForCategory(category: EditorCategory): ContentDirectory {
  return CONTENT_CATEGORY_DIRECTORY[category];
}

export function resolvePublishDate(scheduleAt: string | null, now: () => string = () => new Date().toISOString()) {
  if (scheduleAt) {
    return scheduleAt.slice(0, 10);
  }

  return now().slice(0, 10);
}

export function createEditorWritePayload(draft: EditorDraft) {
  return prepareEditorSubmitPayload(draft);
}

export function createBaseContentFrontmatter(
  payload: EditorWritePayload,
  now: () => string = () => new Date().toISOString(),
  persistedAssets: PersistedEditorAssets = {
    coverPath: payload.cover?.persistedPath ?? payload.cover?.name ?? null,
    assetEntries: payload.assets.map((asset) => ({
      name: asset.name,
      path: asset.persistedPath ?? null,
    })),
  },
): BaseContentFrontmatter {
  const archiveTopic = payload.archiveMeta?.topic ?? "";
  const resourceTopic = payload.resourceMeta?.topic ?? "";
  const base: BaseContentFrontmatter = {
    title: payload.title,
    slug: payload.slug,
    summary: payload.summary,
    description: payload.summary,
    date: resolvePublishDate(payload.scheduleAt, now),
    category:
      payload.category === "archive"
        ? archiveTopic || CATEGORY_LABELS.archive
        : payload.category === "resource"
          ? resourceTopic || CATEGORY_LABELS.resource
          : CATEGORY_LABELS.project,
    tags: payload.tags,
    cover: persistedAssets.coverPath ?? undefined,
    featured: payload.featured ?? false,
    assetNames: persistedAssets.assetEntries.map((entry) => entry.name),
    assetPaths: persistedAssets.assetEntries
      .map((entry) => entry.path)
      .filter((value): value is string => Boolean(value)),
  };

  if (payload.category === "resource") {
    return createResourceFrontmatter(payload, base);
  }

  if (payload.category === "project") {
    return createProjectFrontmatter(payload, base, now);
  }

  return base;
}

export function createContentFileBody({
  frontmatter,
  content,
}: {
  frontmatter: BaseContentFrontmatter;
  content: string;
}) {
  const serializedFrontmatter = Object.fromEntries(
    Object.entries(frontmatter).filter(([, value]) => value !== undefined),
  ) as Record<string, unknown>;
  const yaml = matter.stringify(content.trimEnd(), serializedFrontmatter).trim();
  return `${yaml}\n`;
}

export function buildContentFileSource(
  payload: EditorWritePayload,
  now: () => string = () => new Date().toISOString(),
  persistedAssets?: PersistedEditorAssets,
) {
  return createContentFileBody({
    frontmatter: createBaseContentFrontmatter(payload, now, persistedAssets),
    content: payload.content,
  });
}

export async function readContentCollection<T extends BaseContentFrontmatter = BaseContentFrontmatter>({
  db = getD1Binding(),
  category,
}: {
  db?: D1DatabaseBinding | null;
  category: EditorCategory;
}) {
  if (!db) {
    return [];
  }

  const { items, deletedSlugs } = await listAllD1Content<T>(db, category);
  return items.filter((item) => !deletedSlugs.has(normalizeContentSlug(item.meta.slug)));
}

// 元数据瘦身版集合读取：公开列表页专用。
// 仅在未显式传 db（生产默认 binding）时启用 isolate 级 60s TTL 缓存；
// 测试与编辑器链路显式传 db，绕过缓存保证实时性。
export async function readContentCollectionMeta<T extends BaseContentFrontmatter = BaseContentFrontmatter>({
  db,
  category,
}: {
  db?: D1DatabaseBinding | null;
  category: EditorCategory;
}) {
  const useIsolateCache = db === undefined;
  const resolvedDb = useIsolateCache ? getD1Binding() : db;

  const load = async (): Promise<ContentCollectionMeta<T>[]> => {
    if (!resolvedDb) {
      return [];
    }

    const { items, deletedSlugs } = await listAllD1ContentMeta<T>(resolvedDb, category);
    return items.filter((item) => !deletedSlugs.has(normalizeContentSlug(item.meta.slug)));
  };

  return useIsolateCache && resolvedDb
    ? readThroughD1Cache(`${category}:list`, load)
    : load();
}

export async function readContentBySlug<T extends BaseContentFrontmatter = BaseContentFrontmatter>({
  db,
  category,
  slug,
}: {
  db?: D1DatabaseBinding | null;
  category: EditorCategory;
  slug: string;
}) {
  const useIsolateCache = db === undefined;
  const resolvedDb = useIsolateCache ? getD1Binding() : db;

  const load = async (): Promise<ContentCollectionItem<T> | null> => {
    if (!resolvedDb) {
      return null;
    }

    const item = await getD1ContentBySlug<T>(resolvedDb, category, slug);

    if (item) {
      return item;
    }

    // 墓碑：D1 里有行但 deleted_at 非空 → 明确返回 null，不再兜底到本地
    if (await hasD1ContentRow(resolvedDb, category, slug)) {
      return null;
    }

    return null;
  };

  return useIsolateCache && resolvedDb
    ? readThroughD1Cache(`${category}:item:${normalizeContentSlug(slug)}`, load)
    : load();
}

function inferDraftScheduleAt(date: string | undefined) {
  if (!date) {
    return null;
  }

  return `${date.slice(0, 10)}T00:00`;
}

function sanitizeAssetBaseName(name: string) {
  const parsed = path.parse(name);
  const base = parsed.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const extension = parsed.ext.toLowerCase().replace(/[^.\w-]+/g, "");
  return `${base || "asset"}${extension}`;
}

function sanitizeAssetSlugPart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getPublicAssetDirectory(category: EditorCategory, slug: string) {
  return path.join(process.cwd(), "public", "uploads", getContentDirectoryForCategory(category), sanitizeAssetSlugPart(slug));
}

function getPublicAssetPrefix(category: EditorCategory, slug: string) {
  return `/uploads/${getContentDirectoryForCategory(category)}/${sanitizeAssetSlugPart(slug)}`;
}

async function readFileIfExists(filePath: string) {
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function copyPersistedAssetFile(fromPath: string, toPath: string) {
  const sourcePath = path.join(process.cwd(), "public", fromPath.replace(/^\//, "").replaceAll("/", path.sep));
  const file = await readFileIfExists(sourcePath);

  if (!file) {
    return false;
  }

  await fs.mkdir(path.dirname(toPath), { recursive: true });
  await fs.writeFile(toPath, file);
  return true;
}

async function removeDirectoryIfExists(directoryPath: string) {
  await fs.rm(directoryPath, { recursive: true, force: true }).catch((error: NodeJS.ErrnoException) => {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  });
}

async function persistEditorAssets({
  payload,
  coverUpload,
  assetUploads,
}: {
  payload: EditorWritePayload;
  coverUpload?: EditorUploadedFile | null;
  assetUploads?: EditorUploadedFile[];
}): Promise<PersistedEditorAssets> {
  const assetDirectory = getPublicAssetDirectory(payload.category, payload.slug);
  const assetPrefix = getPublicAssetPrefix(payload.category, payload.slug);

  await removeDirectoryIfExists(assetDirectory);

  let coverPath: string | null = null;

  if (coverUpload) {
    const fileName = `cover${path.extname(coverUpload.name).toLowerCase() || ".bin"}`;
    await fs.mkdir(assetDirectory, { recursive: true });
    await fs.writeFile(path.join(assetDirectory, fileName), coverUpload.buffer);
    coverPath = `${assetPrefix}/${fileName}`;
  } else if (payload.cover?.persistedPath?.startsWith("/")) {
    const nextCoverPath = `${assetPrefix}/cover${path.extname(payload.cover.persistedPath).toLowerCase() || ".bin"}`;
    const copied = await copyPersistedAssetFile(
      payload.cover.persistedPath,
      path.join(assetDirectory, path.basename(nextCoverPath)),
    );
    coverPath = copied ? nextCoverPath : payload.cover.persistedPath;
  }

  const uploadsByName = new Map((assetUploads ?? []).map((upload) => [upload.name, upload]));
  const assetEntries: PersistedEditorAssets["assetEntries"] = [];

  for (const asset of payload.assets) {
    const upload = uploadsByName.get(asset.name);

    if (upload) {
      const fileName = sanitizeAssetBaseName(upload.name);
      await fs.mkdir(path.join(assetDirectory, "assets"), { recursive: true });
      await fs.writeFile(path.join(assetDirectory, "assets", fileName), upload.buffer);
      assetEntries.push({
        name: asset.name,
        path: `${assetPrefix}/assets/${fileName}`,
      });
      continue;
    }

    if (asset.persistedPath?.startsWith("/")) {
      const nextAssetPath = `${assetPrefix}/assets/${sanitizeAssetBaseName(asset.name)}`;
      const copied = await copyPersistedAssetFile(
        asset.persistedPath,
        path.join(assetDirectory, "assets", path.basename(nextAssetPath)),
      );
      assetEntries.push({
        name: asset.name,
        path: copied ? nextAssetPath : asset.persistedPath,
      });
      continue;
    }

    assetEntries.push({
      name: asset.name,
      path: null,
    });
  }

  return {
    coverPath,
    assetEntries,
  };
}

export function createPersistedEditorDraft({
  category,
  slug,
  frontmatter,
  content,
}: {
  category: EditorCategory;
  slug: string;
  frontmatter: BaseContentFrontmatter;
  content: string;
}): PersistedEditorDraftResult {
  const assetNames = frontmatter.assetNames ?? [];
  const assetPaths = frontmatter.assetPaths ?? [];

  return {
    draft: {
      ...createEmptyEditorDraft(),
      title: frontmatter.title,
      slug: frontmatter.slug,
      summary: frontmatter.summary,
      content: content.replace(/^\n+/, ""),
      category,
      tags: frontmatter.tags,
      scheduleAt: inferDraftScheduleAt(frontmatter.date),
      featured: frontmatter.featured,
      projectMeta: {
        href: "href" in frontmatter && typeof frontmatter.href === "string" ? frontmatter.href : "",
        github: "github" in frontmatter && typeof frontmatter.github === "string" ? frontmatter.github : "",
        docs: "docs" in frontmatter && typeof frontmatter.docs === "string" ? frontmatter.docs : "",
        year: "year" in frontmatter && typeof frontmatter.year === "string" ? frontmatter.year : "",
        stack: "stack" in frontmatter && Array.isArray(frontmatter.stack) ? frontmatter.stack : [],
        icon:
          "icon" in frontmatter &&
          (frontmatter.icon === "grid" ||
            frontmatter.icon === "spark" ||
            frontmatter.icon === "pen" ||
            frontmatter.icon === "layers")
            ? frontmatter.icon
            : "grid",
        accent:
          "accent" in frontmatter &&
          (frontmatter.accent === "primary" ||
            frontmatter.accent === "secondary" ||
            frontmatter.accent === "tertiary")
            ? frontmatter.accent
            : "primary",
      },
      resourceMeta: {
        url: "url" in frontmatter && typeof frontmatter.url === "string" ? frontmatter.url : "",
        rating: "rating" in frontmatter && typeof frontmatter.rating === "number" ? frontmatter.rating : 4,
        monogram: "monogram" in frontmatter && typeof frontmatter.monogram === "string" ? frontmatter.monogram : "",
        accent:
          "accent" in frontmatter &&
          (frontmatter.accent === "primary" ||
            frontmatter.accent === "secondary" ||
            frontmatter.accent === "tertiary")
            ? frontmatter.accent
            : "primary",
        topic: category === "resource" ? frontmatter.category : "",
      },
      archiveMeta: {
        topic: category === "archive" ? frontmatter.category : "",
      },
      cover: frontmatter.cover
        ? buildCoverAssetReference(path.basename(frontmatter.cover), frontmatter.cover, frontmatter.cover)
        : null,
      assets: assetNames.map((name, index) =>
        buildAttachmentAssetReference(name, assetPaths[index] ?? null, assetPaths[index] ?? null),
      ),
    },
    source: {
      originalCategory: category,
      originalSlug: slug,
    },
  };
}

export function buildEditorWriteResult({
  payload,
  outputPath,
  persistedAssets = {
    coverPath: payload.cover?.persistedPath ?? payload.cover?.name ?? null,
    assetEntries: payload.assets.map((asset) => ({
      name: asset.name,
      path: asset.persistedPath ?? null,
    })),
  },
  now = () => new Date().toISOString(),
}: {
  payload: EditorWritePayload;
  outputPath: string;
  persistedAssets?: PersistedEditorAssets;
  now?: () => string;
}): EditorWriteResult {
  const frontmatter = createBaseContentFrontmatter(payload, now, persistedAssets);
  const persisted = createPersistedEditorDraft({
    category: payload.category,
    slug: payload.slug,
    frontmatter,
    content: payload.content,
  });

  return {
    ok: true,
    message: `内容已写入${CATEGORY_LABELS[payload.category]}。`,
    slug: payload.slug,
    category: payload.category,
    outputPath,
    draft: persisted.draft,
    source: persisted.source,
  };
}
