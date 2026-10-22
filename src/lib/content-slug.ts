import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

function safelyDecodeSlug(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function normalizeContentSlug(slug: string) {
  return safelyDecodeSlug(slug.trim());
}

// 仅被编辑器写本地链路使用（Commit 6 会一起删除）。
// 查本地 mdx 文件 + 可选的 frontmatter 内 slug 匹配，找不到返回 null。
export async function findContentFileBySlug(
  directory: string,
  slug: string,
) {
  const normalizedSlug = normalizeContentSlug(slug);
  const directPath = path.join(directory, `${normalizedSlug}.mdx`);
  const directSource = await fs.readFile(directPath, "utf8").catch(() => null);

  if (directSource) {
    return {
      filePath: directPath,
      source: directSource,
      slug: normalizedSlug,
    };
  }

  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".mdx")) {
      continue;
    }

    const filePath = path.join(directory, entry.name);
    const source = await fs.readFile(filePath, "utf8").catch(() => null);

    if (!source) {
      continue;
    }

    const { data } = matter(source);
    const frontmatterSlug = typeof data.slug === "string" ? normalizeContentSlug(data.slug) : "";

    if (frontmatterSlug === normalizedSlug) {
      return {
        filePath,
        source,
        slug: frontmatterSlug,
      };
    }
  }

  return null;
}
