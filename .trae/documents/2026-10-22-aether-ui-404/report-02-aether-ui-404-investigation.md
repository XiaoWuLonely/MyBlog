# 调查报告：`pnpm dev` 下 `/projects/aether-ui` 返回 404 的原因

日期：2026-10-22 ｜ 结论：**不是本地与云端数据冲突，而是云端 D1 中的"删除墓碑"按设计生效。**

## 一、结论先行

`aether-ui` 这条项目数据在**云端 D1 里确实存在，但带有删除标记**（`deleted_at` 非空，删除时间 2026-04-27T13:13:09Z，与 calm-editor、nebula-core、studio-notes、welcome 是同一批次的批量删除）。代码的既定行为是：云端有删除墓碑时，**禁止本地静态文件"复活"该内容**，于是详情页返回 null → 404。生产环境与本地 dev 行为一致，不是 dev 特有的 bug。

## 二、证据链（逐项实测）

### 1. dev 模式直连的是云端远程 D1，不是本地库
[wrangler.jsonc](../../wrangler.jsonc) 中 `MYBLOG_DB` 配置了 `"remote": true`；[next.config.ts](../../next.config.ts) 里的 `initOpenNextCloudflareForDev()` 让 `pnpm dev` 也能拿到这个绑定。所以 dev 和线上读的是**同一个远程数据库**（实测 `served_by_region: APAC`，主区域 SIN），不存在"本地库 vs 云端库"两份数据。

### 2. 云端 D1 实测数据
对远程库执行查询（`content_items` 表）：

| slug | deleted_at | 含义 |
|---|---|---|
| aether-ui | 2026-04-27T13:13:09Z | **已删除（墓碑）** |
| calm-editor | 同批次 | 已删除 |
| nebula-core | 同批次 | 已删除 |
| studio-notes | 同批次 | 已删除 |
| welcome | 2026-04-28 | 已删除 |
| codex-desktop-rebuild | NULL | 正常显示 |
| baoyu-skills | NULL | 正常显示 |

### 3. 代码路径（[content.ts](../../src/lib/content.ts) `readContentBySlugWithD1Fallback`）
1. D1 查活行 → aether-ui 有墓碑，查不到活行；
2. `hasD1ContentRow` 发现**行存在（墓碑）→ 直接返回 null**（不读本地文件）；
3. 页面拿到 null → 404。

本地 [src/content/projects/aether-ui.mdx](../../src/content/projects/aether-ui.mdx) 文件确实存在，但按设计被墓碑遮蔽。这个机制是刻意为之：防止"在编辑器里删掉的内容被仓库里打包的旧文件复活"（见 cloudflare-content-store.test.mjs 中 "D1 delete creates a tombstone..." 测试）。

## 三、那 404 到底对不对？

取决于你的意图：

- **如果你当初就是在编辑器里删掉了 aether-ui** → 404 是正确行为，线上线下一致，无需处理。
- **如果你想让 aether-ui 重新显示** → 在编辑器里重新发布一次（或清除该 slug 的 `deleted_at`），云端有了活行，本地静态文件依旧被忽略，全环境统一显示云端版本。

## 四、关于"移除本地存储、只保留云端"

当前架构实际上已经是**云端为唯一事实源**：

- 列表/详情读取顺序永远是 D1 优先；本地 `src/content/**` 的 mdx 只在 D1 **完全为空**（首次部署播种）时才作为兜底出现；
- 墓碑机制保证删除语义以云端为准；
- `MYBLOG_FILE_STORAGE=readonly` 已禁止在 Cloudflare 运行时写文件。

所以"移除本地存储"本质是**删除这套播种兜底**（`src/content/posts|projects|resources` 目录 + content.ts 里的 fallback 分支 + 相关测试），收益是代码更直白、仓库不再携带内容副本；代价是首次部署空库时站点没有任何初始内容，且部分依赖静态文件的测试需要改写。这是一项独立的重构任务，建议另开分支执行，不要混入本次维护分支。

## 五、附：为什么以前"看着正常"

这些 mdx 是仓库重构初期打包的示例内容。2026-04-27 的批量删除把它们从云端清掉后，任何读云端的入口（生产、以及配置 remote 绑定的 dev）都会按墓碑返回 404；只有完全脱离 D1 的旧本地模式才会继续显示它们——这正是"本地与云端表现不一致"体感的来源，但方向与猜测相反：**是本地静态文件太"旧"，而不是云端数据丢了**。
