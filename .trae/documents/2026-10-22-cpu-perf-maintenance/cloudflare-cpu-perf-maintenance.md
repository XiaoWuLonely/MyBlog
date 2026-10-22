# Cloudflare CPU 超限排错与性能优化计划

## Summary（目标）

在新建的维护分支上，系统性解决 wulongblog（Next.js 16 + OpenNext Cloudflare + D1，Free 套餐 10ms CPU 预算）的三类症状：

1. **莫名报错**：`Worker exceeded CPU time limit`，连 `/cms/wp-includes/wlwmanifest.xml` 这类扫描器请求也会触发。
2. **切换页面卡顿**：每次导航都是全量 SSR + D1 全表查询，TTFB 慢；前端过渡动画开销大。
3. **提交报错**：编辑器发布链路在长内容 / 冷启动下 CPU 超限，且 D1 异常未做结构化兜底。

用户已确认：**Free 套餐**、四个方向全覆盖（垃圾请求拦截、服务端缓存+查询瘦身、ISR 静态化、前端动画减负）。

---

## Current State Analysis（现状与根因）

### 架构事实（均已核实）

- Next.js 16.2.3 App Router，`cacheComponents: true`、`reactCompiler: true`（[next.config.ts](file:///d:/Studio/MyBlog/next.config.ts#L9-L16)），Webpack 构建（README 注明 Turbopack server chunks 在 Worker 中加载不可靠）。
- 部署：`@opennextjs/cloudflare@1.20.6`，入口 `.open-next/worker.js`；D1 binding `MYBLOG_DB`（[wrangler.jsonc](file:///d:/Studio/MyBlog/wrangler.jsonc#L14-L21)）。
- [open-next.config.ts](file:///d:/Studio/MyBlog/open-next.config.ts) 是**空配置** `defineCloudflareConfig()` → incremental cache 为 dummy，**ISR/revalidatePath 实际不生效**，所有路由每次请求全量 SSR。
- 内容：16 个 MDX，34KB 静态注册表；运行时 D1 优先、静态注册表兜底（[content.ts](file:///d:/Studio/MyBlog/src/lib/content.ts#L247-L293)）。
- **全站无任何缓存**：grep 确认无 `use cache` / `unstable_cache` / `force-static` / `revalidate` 导出。

### 根因 1：每个请求 = 全量 SSR + D1 全表扫描 + 全量解析（CPU 主凶）

- `cacheComponents` 模式下页面未声明 `"use cache"`，且 `isAdminRequest()` 读 cookies（[admin-auth-server.ts](file:///d:/Studio/MyBlog/src/lib/admin-auth-server.ts#L11-L26)）→ 所有公开页面**永久动态渲染**。
- 列表查询 `listAllD1Content` SELECT 了 `body, source` 等大字段并逐行 `JSON.parse`（[cloudflare-content-store.ts](file:///d:/Studio/MyBlog/src/lib/cloudflare-content-store.ts#L248-L278)）；`getAllPosts` 对每篇文章跑 `readingTime()`（[posts.ts](file:///d:/Studio/MyBlog/src/lib/posts.ts#L36-L52)）。
- 详情页三重放大：`generateMetadata` 调 `getPostBySlug`、页面再调一次（无 React `cache()` 去重）、`getAdjacentPosts` 又调 `getAllPosts()` 全表扫描（[posts/[slug]/page.tsx](file:///d:/Studio/MyBlog/src/app/posts/%5Bslug%5D/page.tsx#L23-L53)）。单次文章访问 ≈ 4 次 D1 查询 + 2 次全量解析。
- 404 路径（如 `/cms/wp-includes/...`）同样走完整 root layout + AppFrame SSR → Free 套餐 10ms CPU 预算下，冷启动 isolate 直接超限。

### 根因 2：预取风暴放大 7 倍

[frame.tsx](file:///d:/Studio/MyBlog/src/components/site/frame.tsx#L414-L428) 挂载时对 7 条路由 `router.prefetch()`（含重量级的 `/editor`）。动态路由 prefetch = 完整 RSC SSR → 首次落地即 7 次 worker 渲染，互相争抢同一 isolate 的 CPU 预算。

### 根因 3：提交链路无兜底 + revalidate 空转

- [editor/api/posts/route.ts](file:///d:/Studio/MyBlog/src/app/editor/api/posts/route.ts#L103-L165) 中 D1 写入、formData 解析无 try/catch 兜底，CPU 超限或 D1 异常时用户只看到裸 500。
- 每次发布调 `revalidatePath` ×7（[editor/api/shared.ts](file:///d:/Studio/MyBlog/src/app/editor/api/shared.ts#L8-L27)），但 dummy cache 下全部空转——发布后用户端仍 SSR，问题 1 持续存在。
- 携带封面上传时被 `resolveD1PersistedAssets` 直接抛错（已知限制，README 已注明，保持现状）。

### 根因 4：前端过渡动画开销

- 过渡含多层 `filter: blur(10~20px) saturate()` + 5 组 spring 同时驱动（[frame.tsx](file:///d:/Studio/MyBlog/src/components/site/frame.tsx#L645-L707)），中低端设备掉帧。
- 新页面就绪后用 rAF 轮询 `.page-loading-shell`，就绪后再硬等 680ms（`ENTER_SETTLE_MS`）才结束过渡（[frame.tsx](file:///d:/Studio/MyBlog/src/components/site/frame.tsx#L40-L40), [L581-L584](file:///d:/Studio/MyBlog/src/components/site/frame.tsx#L581-L584)），叠加服务端 TTFB 慢，主观卡顿明显。

---

## Proposed Changes（变更方案）

### 第 0 步：建维护分支

```powershell
git switch -c maintenance/cpu-perf main
```

分支名：`maintenance/cpu-perf`（从当前干净 `main`@`8185c5a` 切出，符合 AGENTS.md「从 main 出发」约定）。

### 第 1 步：垃圾请求拦截 + 去预取风暴（最快见效）

**1a. 新建 `src/middleware.ts`**（当前不存在）：

- `matcher` 覆盖全部路径，但在 middleware 内对已知垃圾前缀（`/wp-`, `/cms/`, `/wordpress/`, `/xmlrpc.php`, `*.xml` 中非 sitemap/feed 的、`/.env`, `/vendor/` 等）直接 `return new Response(null, { status: 404 })`，不进入 Next 渲染管线。
- 白名单：`/sitemap.xml`、静态资产、`_next/` 放行。
- 预期效果：扫描器请求 CPU 从「整页 SSR」降到「亚毫秒字符串匹配」。

**1b. 删除 prefetch 风暴**：[frame.tsx](file:///d:/Studio/MyBlog/src/components/site/frame.tsx#L414-L428) 整个 `router.prefetch` useEffect 删除。ISR 落地后页面本身已是缓存命中，无需手动预热；后续如确需，仅保留 `/archive` 一条。

### 第 2 步：服务端缓存 + 查询瘦身（不动部署配置）

**2a. 请求内去重**：用 React `cache()` 包裹 `getPostBySlug`、`getAllPosts`、`getProjectBySlug`、`getResourceBySlug` 等（[posts.ts](file:///d:/Studio/MyBlog/src/lib/posts.ts) 及对应 projects/resources 模块），消除 generateMetadata + 页面 + adjacent 的重复查询。

**2b. 列表查询瘦身**：在 [cloudflare-content-store.ts](file:///d:/Studio/MyBlog/src/lib/cloudflare-content-store.ts) 新增 `listD1ContentMeta`——列表场景只 SELECT `slug, title, summary, category, tags_json, frontmatter_json, published_at, updated_at, deleted_at`，**去掉 `body, source`**；`getAllPosts` / projects / resources 列表与 `getAdjacentPosts` 改用它。

**2c. readingTime 降级**：`getAllPosts` 不再逐篇跑 `readingTime()`；详情页保留（单篇成本可忽略）。归档卡片若需显示时长，由详情数据或 frontmatter 提供，本次直接省略列表中的时长计算。

**2d. isolate 级 TTL 缓存**：新增 `src/lib/d1-cache.ts`，模块级 `Map` + 60s TTL + `cacheTag` 维度（`collection:posts` 等），包裹 2b 的查询；`saveD1Content` / `deleteD1Content` / 消息写入成功后同步 `invalidate()` 本 isolate。这是对 ISR 落地前的兜底，也是 ISR 之后的 L1。

### 第 3 步：ISR 静态化（Free 套餐的根治手段）

**3a. 配置 OpenNext 缓存**（[open-next.config.ts](file:///d:/Studio/MyBlog/open-next.config.ts)）：

- `incrementalCache`: `kvIncrementalCache`（新增 KV namespace binding `NEXT_INC_CACHE_KV`；KV 免费额度 100k 读/天，个人博客足够）。
- `tagCache`: `d1NextTagCache`，**复用现有 `MYBLOG_DB`**（实施时先读 `node_modules/@opennextjs/cloudflare/dist/api/overrides/tag-cache/d1-next-tag-cache.js` 确认所需表结构，新增 `migrations/0003_next_tag_cache.sql` 并 remote 执行）。
- 实施前通读 `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/cacheComponents.md` 与 `01-app/02-guides/migrating-to-cache-components.md`（AGENTS.md 强制要求）。

**3b. 公开页静态化**：对 `/`、`/archive`、`/posts/[slug]`、`/projects`、`/projects/[slug]`、`/resources`、`/resources/[slug]`、`/about`：

- 数据访问函数（2a 的产物）加 `"use cache"` + `cacheTag()`（如 `content:archive`、`content:archive:{slug}`）+ `cacheLife({ revalidate: 300, expire: 3600 })`。
- 注意：`"use cache"` 内不能读 request API。D1 binding 改用 `getCloudflareContext({ async: true })` 在缓存函数内部获取（OpenNext 官方模式）；若验证不可行，回退为 `unstable_cache`（同样落 KV incremental cache）。**实施时先用一个页面验证，再推广**。
- `isAdminRequest()`（cookies）会把路由打回动态：将「编辑/删除按钮」等 admin  affordance 移入 `<Suspense>` 动态洞（PPR），页面外壳保持可缓存。`/editor`、`/admin`、`/api/*` 保持全动态，不动。

**3c. 发布即失效**：[editor/api/shared.ts](file:///d:/Studio/MyBlog/src/app/editor/api/shared.ts) 的 `revalidatePath` 批量调用改为 `revalidateTag`，与 3b 的 cacheTag 对齐；验证「发布 → 列表页/详情页在 TTL 内刷新」端到端走通。

### 第 4 步：前端动画减负

[frame.tsx](file:///d:/Studio/MyBlog/src/components/site/frame.tsx)：

- 入场/出场初始 `filter` 从 `blur(18px) saturate(0.82)` 降为 `blur(6px)` 或直接去掉 blur，只保留位移+透明度。
- `ENTER_SETTLE_MS` 680ms → 260ms。
- rAF 轮询 `.page-loading-shell` 改为 `MutationObserver`（`childList` + `subtree`），避免空转。
- spring 组从 5 组（x/y/scaleX/scaleY/rotate）减为 3 组（x/scale/opacity）。

### 第 5 步：提交链路兜底 + 文档同步

- [editor/api/posts/route.ts](file:///d:/Studio/MyBlog/src/app/editor/api/posts/route.ts)：`saveD1Content`/`deleteD1Content` 调用包 try/catch，D1 异常返回结构化 502（`{ ok:false, message:"数据库写入失败，请稍后重试。" }`），不再裸抛。
- 完成代码变更后更新 README：ISR/KV binding 说明、新增环境准备步骤（KV namespace 创建、tag 表 migration），遵守 AGENTS.md「行为与 README 不一致时同步 README」。

---

## Assumptions & Decisions（假设与决策）

1. **KV 而非 R2** 做 incremental cache：KV 免费读额度（100k/天）高于 R2 Class B（约 33k/天），博客读多写少，KV 更合适。
2. **tag cache 复用现有 D1**：避免新增 D1 实例；`d1-next-tag-cache` 所需表以新 migration 提供。
3. **不动上传限制**：Cloudflare 上封面/附件上传仍拒绝（README 已有说明），仅保证报错信息友好。
4. **admin 按钮改 Suspense 动态洞**：这是 `cacheComponents` 下兼顾「页面可缓存 + 管理员看到编辑入口」的标准做法；实现后需验证非管理员无闪烁、管理员正常显示。
5. **isolate TTL 缓存与 ISR 并存**：L1（60s isolate）+ L2（KV incremental cache）。发布时双失效：revalidateTag（L2）+ 同 isolate invalidate（L1）；跨 isolate 最长 60s 可见，个人博客可接受。
6. **`getCloudflareContext({async:true})` 在 `"use cache"` 内的可用性**是最大技术不确定点 → 第 3b 步先做单页验证（选 `/archive`），失败则全量回退 `unstable_cache` 方案，不影响其他步骤。
7. wrangler.jsonc 将新增 KV binding；本地 `cf:preview` 同样需要该 namespace（preview 可用 `--remote` 复用同一个）。

## Verification（验证）

按顺序执行，任一失败即回查对应步骤：

1. `npm test`、`npm run typecheck`（顺序执行，不并行）、`npm run lint`。
2. `npm run build`（Webpack 生产构建通过）。
3. `npm run cf:build && npm run cf:preview`：本地 preview 逐项手测——
   - `curl http://localhost:8787/cms/wp-includes/wlwmanifest.xml` → 秒回 404，worker 日志无 SSR。
   - `/archive`、`/posts/<slug>` 二次访问应命中缓存（响应头/日志确认 ISR HIT）。
   - 编辑器发布一篇测试文 → 列表页在 revalidateTag 后立即更新；删除后 404。
   - About 页留言提交成功；admin 登录后详情页出现编辑/删除按钮（Suspense 洞内）。
4. `npm run cf:deploy` 部署后，用 wrangler tail 观察 10 分钟：确认无 `CPU time limit` error，扫描器路径均为快速 404。
5. 主观体验：站内连续切换 5 个页面，过渡动画在 60fps 附近、无长白屏。
