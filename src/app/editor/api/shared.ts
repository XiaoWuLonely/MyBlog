import { revalidateTag } from "next/cache";
import type { EditorCategory } from "@/lib/editor";

export function editorContentRootDir() {
  return `${process.cwd().replaceAll("\\", "/")}/src/content`;
}

const CATEGORY_CACHE_TAG: Record<EditorCategory, string> = {
  archive: "content:archive",
  project: "content:project",
  resource: "content:resource",
};

// 发布/更新后：使该类目所有 "use cache" 条目（列表 + 各详情 + 相邻/相关）失效。
// 详情条目同时打了类目标签，类目级 revalidateTag 即可全覆盖。
// 第二参数 "max" = SWR 语义（OpenNext D1 tag cache 对 expire 模式支持不完整，勿用 {expire:0}）。
export function revalidateEditorContentRoutes(category: EditorCategory) {
  revalidateTag(CATEGORY_CACHE_TAG[category], "max");
}

// 变更前类目（slug 或类目可能被改过）同样需要失效，避免旧路径残留缓存。
export function revalidatePreviousContentRoute(category: EditorCategory) {
  revalidateTag(CATEGORY_CACHE_TAG[category], "max");
}
