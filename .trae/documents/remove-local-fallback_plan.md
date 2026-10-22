# 移除本地 MDX 兜底 实施计划（v2，彻底删除版）

日期：2026-10-22 ｜ 目标：彻底删除本地 MDX 读写链路，内容唯一来源是云端 D1
分支：新建 `maintenance/remove-local-fallback`，每完成一个小功能块 commit 一次

## 一、要删除的链路（两条，全砍）

| 链路 | 现状 | 改后 |
|---|---|---|
| **运行时读本地** | posts/projects/resources 三个 getter 传入 fallback 回调，D1 空时读 src/content/**/*.mdx → staticContentRegistry | **完全删除 fallback 参数和调用**；D1 空直接返回 null/[] |
| **编辑器写本地** | editor route.ts 发布时**同时写 D1 + 写 src/content/** 下的 mdx 副本 | **只写 D1**，本地 mdx 文件系统写入整条链路删除 |

## 二、按 commit 拆分的实施步骤

### Commit 1：删 package.json 里的静态生成脚本引用

- `package.json` 里的 `prebuild` 整个删（原来是 `node scripts/generate-static-content-registry.mjs`）
- `cf:build` / `cf:preview` / `cf:deploy` 里开头的 `node scripts/generate-static-content-registry.mjs && ` 前缀删掉，只留 `opennextjs-cloudflare build` 或 `opennextjs-cloudflare build && opennextjs-cloudflare preview/deploy`

### Commit 2：删静态内容生成脚本和产物

删除：
- `scripts/generate-static-content-registry.mjs`
- `src/lib/static-content.ts`（或 `.js`、`.mjs`，删前先 ls 确认实际文件名）
- `src/content/generated/static-content-registry.{ts,js,d.ts}`（3 个生成物）
- Grep 确认没有别的文件 import 这些

### Commit 3：删 content.ts 里的本地文件读写工具

从 `src/lib/content.ts` 删除：
- 导出函数：`getAbsoluteContentFilePath`、`readContentCollectionFromFilesystem`（或叫 `readStaticContentCollection`）、`parseContentCollectionItem`、`readContentBySlugFromStatic`、`findContentFileBySlug`（如果是在 content.ts 里定义的）
- 本地文件读写相关 import：`node:fs/promises`（`export fs` 保留，编辑器写 D1 不直接用 fs，但要确认 `copyPersistedAssetFile` 等是否还用到——它们可能用来处理上传图片到 public/uploads）
- `getStaticContentEntries` 相关代码

**保留**：
- 三个 `*WithD1Fallback` 函数签名改造成不再接收 fallback 参数（见 Commit 4）
- `hasD1ContentRow`、`getD1ContentBySlug`、`listAllD1Content*`（纯 D1 读，保留）
- 墓碑逻辑不动（`hasD1ContentRow` 发现行存在但 deleted_at 非空 → 返回 null）
- 编辑器写 D1 用到的工具函数（`toFrontmatterSource`、`buildItemFromD1Row`、`revalidateEditorContentRoutes` 等）

### Commit 4：简化三个 `*WithD1Fallback` 函数（content.ts）

把三个函数签名里的 `fallback` 参数**删除**，内部逻辑改成：

```ts
// 改造前
export async function readContentBySlugWithD1Fallback({ db, category, slug, fallback }) {
  const item = await getD1ContentBySlug(...);
  if (item) return item;
  if (await hasD1ContentRow(...)) return null;   // 墓碑
  return fallback();                              // 删
}

// 改造后
export async function readContentBySlug({ db, category, slug }) {
  const item = await getD1ContentBySlug(...);
  if (item) return item;
  if (await hasD1ContentRow(...)) return null;   // 墓碑
  return null;                                    // D1 空 → 彻底没有
}
```

两个集合读取函数同理：`readContentCollectionWithD1Fallback` → `readContentCollection`，`readContentCollectionMetaWithD1Fallback` → `readContentCollectionMeta`。

**重要**：保留带 D1 TTL 缓存的版本（`useIsolateCache && resolvedDb ? readThroughD1Cache(...) : load()`），缓存逻辑不动。

### Commit 5：改 posts.ts / projects.ts / resources.ts

每个文件做同样的事（3 个文件并行改，分 3 个 commit 或 1 个）：
- import 行：把 `readContentBySlugWithD1Fallback` 改成 `readContentBySlug`；把 `readContentCollectionMetaWithD1Fallback` 改成 `readContentCollectionMeta`；删 `getStaticContentEntries`、`findContentFileBySlug`、`POSTS_DIR` / `PROJECTS_DIR` / `RESOURCES_DIR` 常量等本地读相关
- `getAllPosts`（或 projects/resources 对应函数）：删除整个 `fallback: async () => ...` 回调，直接调用新的 `readContentCollectionMeta`（无 fallback）
- `getPostBySlug`（或 projects/resources 对应函数）：同上
- `getPostSlugs`（或 projects/resources 对应函数）：删除 fs.readdir fallback，**改成只从 D1 取 slug 列表**（新增一个 `listAllD1ContentMeta` 或 `getAllD1Slugs` 封装）

### Commit 6：删编辑器写本地链路

从 `src/lib/content.ts` 删除：
- `getContentDirectoryForCategory`（`content.ts` 里定义的版本，**但 editorContentRootDir 里可能有独立实现**——先 grep 确认哪些地方 import 这个函数，编辑器路径用的可能是自己的独立函数）
- `getPublicAssetDirectory` / `getPublicAssetPrefix`（如果只用于本地文件写入）
- 所有 `writeContentFile` / `deleteContentFile` / `renameContentFile` / `copyPersistedAssetFile` 等写本地的工具函数
- 编辑器发布/删除/重命名里调用这些工具的逻辑（在 `src/app/editor/api/posts/route.ts`）

从 `src/app/editor/api/shared.ts` 删除：
- `editorContentRootDir()` 函数（整个文件如果只剩 revalidate 函数就保留，删 editorContentRootDir 导出）
- revalidateTag 函数**保留**（失效 ISR 缓存必须）

从 `src/app/editor/page.tsx` 删除：
- 所有 `editorContentRootDir()` 的 import 和调用（编辑器 UI 可能把 rootDir 传给某个组件显示本地路径——先 grep 看具体怎么用的）

### Commit 7：删 src/content 本地 mdx 目录（可选）

- 如果 Commit 6 验证编辑器发布正常、测试全过，可以**删除** `src/content/posts/`、`src/content/projects/`、`src/content/resources/` 三个目录（共几百个 mdx 文件）
- **保留** `src/content/` 根目录（可能有 `.gitkeep` 或 README）
- **保留** `scripts/export-content-for-d1.mjs`——这是"从本地批量播种到 D1"的运维工具，现在还需要它把仓库历史里的 mdx 一次性导入 D1（**但运行时不再依赖它**）

### Commit 8：删测试里的 fallback 断言

- `src/lib/cloudflare-content-store.test.mjs`：所有测试里 `fallback` 回调参数删除；"D1 为空时 fallback 生效"相关测试改成"返回空"或直接删
- `src/lib/content.test.mjs`：`getContentDirectoryForCategory` 相关测试（编辑器还用）保留；本地文件读写相关测试删
- 先跑一遍 `npm test` 看哪些挂了再定向改

### Commit 9：删其他引用，验证全链路

- Grep 全项目 `WithD1Fallback`、`staticContentRegistry`、`readdir.*content`、`POSTS_DIR`、`PROJECTS_DIR`、`RESOURCES_DIR`、`editorContentRootDir`、`writeContentFile`、`getAbsoluteContentFilePath` 等关键字，确保没有死残留
- `npm test`、`npm run typecheck`、`npm run build`、`npm run cf:build` 全过
- `wrangler dev` + 远程 D1 手测：/ 、/archive 、/projects 、/resources 列表正常渲染、编辑器发布后 D1 有新行、`revalidateTag` 后页面秒刷新

## 三、需要保留的代码清单

| 文件 | 保留理由 |
|---|---|
| `src/lib/cached-content.ts` | Next "use cache" 包装，ISR 入口，继续工作 |
| `src/lib/d1-cache.ts` | Isolate 级 TTL 读穿缓存，继续工作 |
| `src/lib/cloudflare-content-store.ts` | D1 查询函数（`getD1ContentBySlug`、`listAllD1Content`、`hasD1ContentRow`），运行时读核心 |
| `src/lib/posts.ts`（**修改后**） | 保留函数签名但改成只调 D1，不再传 fallback |
| `src/app/editor/api/shared.ts#revalidateEditorContentRoutes` | 失效 ISR 缓存必须 |
| `scripts/export-content-for-d1.mjs` | 运维工具，把仓库历史 mdx 一次性导入 D1 |
| `wrangler.jsonc#MYBLOG_FILE_STORAGE=readonly` | 继续保留（已经禁止 Cloudflare 运行时写文件） |

## 四、风险

| 风险 | 处理 |
|---|---|
| **编辑器删除写本地后，Markdown 源码永远只在 D1** | D1 有 JSON 导出工具，`wrangler d1 export myblog --remote` 可随时备份。`source` 字段存了完整 Markdown 源码 |
| **删除 src/content/posts|projects|resources 后 git 历史里找内容不方便** | 不删目录也行，空目录 + git 历史就能追溯。Commit 7 可选 |
| **某个测试或隐藏功能偷偷引用了本地文件读写** | 删代码 + Grep 全套关键字 → `npm test` 覆盖 → `typecheck` 抓 import 残留 |
| **`cf:build` 删 prebuild 后会不会影响 OpenNext bundle** | 不会——OpenNext 不依赖我们的 staticContentRegistry，它 trace D1 调用链路 |

## 五、分支与 commit 规范

- 新分支：`maintenance/remove-local-fallback`（从 main 最新提交起步）
- 每个 commit 一个小功能块（Commit 1 → Commit 9）
- Conventional commit 格式
- 每步完成跑 `npm test` + `npm run typecheck` + `npm run build` + `npm run cf:build` 至少一个

## 六、执行顺序

Commit 1→2（删脚本引用 + 删脚本文件）→ Commit 3→4（改 content.ts）→ Commit 5（改三个 getter）→ Commit 6（删编辑器写本地）→ Commit 7（可选删 src/content 子目录）→ Commit 8（改测试）→ Commit 9（扫残留 + 全链路验证）
