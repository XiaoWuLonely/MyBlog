# 维护报告：彻底移除本地 MDX 兜底（maintenance/remove-local-fallback）

日期：2026-10-22 ｜ 分支：`maintenance/remove-local-fallback`（9 个提交，`0ffa512..01d3cea`）

目标：内容唯一来源收敛为云端 D1，本地文件读写链路整体废弃，不再对本地做任何新增或维护。

## 一、发现的问题

### P0 — 移除兜底后详情页在 dev 下直接 500
本地 mdx 删掉后，`/posts/[slug]`、`/projects/[slug]`、`/resources/[slug]` 的 `generateStaticParams` 只剩 D1 一条数据源。Next 16 开启 Cache Components 后，该函数返回空数组会抛 `EmptyGenerateStaticParamsError`（校验阶段拿不到 D1 绑定，请求期才有）。实测 `/projects/baoyu-skills` 返回 500，而同一数据源的 `/projects` 列表页 200 —— 说明数据是通的，问题只在 params 校验。

### P0 — 补占位参数后 `npm run build` 仍然失败
占位 slug 被当成真页面预渲染，而 `getPostBySlug` 对不存在的 slug 直接 `throw new Error("Post not found")`，构建在 `Export encountered an error on /posts/[slug]/page: /posts/__placeholder__` 处退出。

### P0 — 隐藏炸弹：列表页会被预渲染成空列表
构建期 worker 拿不到 D1 binding，`/projects`、`/about` 这类纯读列表的整页静态路由会把「空列表」固化进增量缓存。部署后最长一个 `revalidate` 周期（300s）内用户看到的是空站点。这个问题在移除兜底前不存在，因为本地 mdx 让构建期永远有数据。

### P1 — 编辑器双写：D1 + 本地 mdx 文件
发布/删除要同时写 D1 和 `src/content/**/*.mdx`，改一处不同步就会出现「云端有、本地无」或反之的漂移。

### P1 — slug 枚举依赖 `fs.readdir`
`getPostSlugs` 等走文件系统读目录，在 Workers 运行时不可用，之前靠「构建期静态 registry」掩盖。

### P2 — 每次构建全量生成静态内容 registry
`prebuild` 阶段扫描全部 mdx 并生成 `static-content-registry.{ts,js,d.ts}`，是纯冗余产物。

## 二、实施的改动

| 提交 | 内容 |
|---|---|
| `5f2ddff` | `build:` 去掉 package.json 的 `prebuild` 与 `cf:build`/`cf:preview`/`cf:deploy` 前缀 |
| `b9afcfe` | `chore:` 删生成脚本与产物共 6 个文件（`scripts/generate-static-content-registry.mjs`、`src/lib/static-content.{ts,js}`、`src/content/generated/*`） |
| `4ca5681` | `refactor(content):` 三个读函数去掉 `fallback` 参数并改名（`readContentCollection` / `readContentCollectionMeta` / `readContentBySlug`） |
| `950b68b` | `refactor(content-getters):` posts/projects/resources 全走 D1，`getSlugs` 从 `fs.readdir` 改为查 D1 meta |
| `b66c458` | `refactor(editor):` 删本地写/删/更新链路，编辑器只写 D1（4 文件 −366 行） |
| `6a7aa15` | `chore:` 删 `src/content/posts|projects|resources` 共 17 个 mdx（−1179 行） |
| `9a769e7` | `test:` 删 3 个过时测试文件、修正 4 个，去掉 fallback 断言（7 文件 −1126 行） |
| `a5b72ee` | `fix(routes):` 三个详情路由在枚举为空时返回 `__placeholder__`，交给 `notFound()` |
| `01d3cea` | `fix(build):` `/projects`、`/about` 用 `connection()` 推迟到请求期渲染；`getPostBySlug` 改返回 `null` |

## 三、量化指标

### 代码与资产
| 指标 | 移除前 | 移除后 |
|---|---|---|
| 分支累计变更 | — | **45 个文件**（新增 2 / 修改 18 / 删除 25），**+310 / −3232 行**（净 −2922） |
| 仓库内 `.mdx` 内容文件 | 17 | **0** |
| 静态 registry 生成脚本与产物 | 6 | **0** |
| 构建期生成步骤 | 1（prebuild 全量扫描） | **0** |
| 测试文件 | 22 | **19**（删 3 个只测兜底的用例集） |
| 测试结果 | — | **99 tests / 99 pass / 0 fail** |
| `npx tsc --noEmit` | — | **0 error** |

### 数据源与运行时
| 指标 | 移除前 | 移除后 |
|---|---|---|
| 内容读取数据源 | 2 条（D1 + 本地 mdx / 静态 registry） | **1 条（D1）** |
| 编辑器写入目标 | 2 处（D1 + 本地文件，需保持一致） | **1 处（D1）** |
| slug 枚举 | `fs.readdir` 扫目录（Workers 不可用） | 1 次 D1 meta 查询（react `cache` 请求内去重 + isolate 60s TTL 命中后 0 次） |
| 列表页渲染时机 | 构建期固化（构建期无数据 → 空列表） | **请求期**（`connection()`），数据仍由 `use cache` 缓存 |
| 部署后列表为空的窗口 | ≤ 300s（`revalidate` 周期） | **0** |

### 构建与路由
| 检查项 | 移除前 | 移除后 |
|---|---|---|
| `npm run build` | 失败（`/posts/__placeholder__` 预渲染抛错） | **通过** |
| `npm run cf:build` | 通过 | **通过**（产出 `.open-next/worker.js`） |
| `/projects/baoyu-skills`（dev） | **500**（`EmptyGenerateStaticParamsError`） | **200**，67,896 字节 |
| `/projects`（dev） | 200 | 200，10 个项目链接 |
| `/`、`/archive`、`/resources`、`/about` | 200 | 200 |

## 四、行为变化对照

| 场景 | 移除前 | 移除后 |
|---|---|---|
| D1 有数据 | 读 D1 | 读 D1（不变） |
| **D1 无该 slug** | 回落到本地 mdx | **404**（不再有第二条路径） |
| **D1 为空** | 回落本地 mdx 全量 | 列表为空、详情 404 |
| 云端已删除某内容 | 可能被本地 mdx 复活 | 墓碑（`deleted_at`）拦截，返回 `null` |
| 编辑器发布 | 写 D1 + 写 mdx 文件 | 只写 D1 + `revalidateTag` |
| 编辑器删除 | 删 D1 行 + 删 mdx 文件 | 只写墓碑 |

## 五、验证方式

1. `npm test` → 99 pass / 0 fail；`npx tsc --noEmit` → 干净。
2. `npm run build` → 通过（此前在 `__placeholder__` 预渲染处失败）。
3. `npm run cf:build` → 通过。
4. `npx wrangler dev --port 3100`（真实 workerd + 远程 D1）实测：`/projects` 200 且有 10 个项目链接、`/projects/baoyu-skills` 200（命中 50 次关键词）、`/about` 渲染出 D1 中的项目标题、`/resources` 与 `/archive` 均有真实内容。
5. 残留关键字全库扫描零命中：`WithD1Fallback`、`staticContentRegistry`、`POSTS_DIR` / `PROJECTS_DIR` / `RESOURCES_DIR`、`editorContentRootDir`、`writeEditorContentFile` / `deleteEditorContentFile` / `updateEditorContentFile`、`getAbsoluteContentFilePath` / `getPersistedEditorDraftBySource` / `getEditorWriteValidationResult`。

## 六、遗留项与风险

- **编辑器发布/删除链路未在 Worker 运行时手测**：POST 写 D1 后 `revalidateTag("content:<category>", "max")` 是否秒级刷新、DELETE 墓碑是否生效，需要 `npm run cf:preview` 或 `npx wrangler dev` 下用管理员账号点一遍。
- **`npm start` 不能验证发布**：实测 route handler 内 `getD1Binding()` 为 `null`（页面渲染却正常），编辑器 API 会 503。本地完整验证只能走 `cf:preview` / `wrangler dev`。
- **`scripts/export-content-for-d1.mjs` 已成空输入工具**：它读 `src/content/{posts,projects,resources}`，这些目录已删除，运行只输出 header。建议后续连同 `src/lib/d1-export-script.test.mjs` 与 README 中的播种步骤一起删除。
- **`src/content/generated/` 为空目录**：git 不跟踪空目录，如需彻底清理可在本地 `Remove-Item -Recurse`。
- 本地 `next build` 现在能通过，但构建期仍然没有 D1 数据，所以构建产物里的详情页只有占位参数；真实内容一律在请求期渲染。
