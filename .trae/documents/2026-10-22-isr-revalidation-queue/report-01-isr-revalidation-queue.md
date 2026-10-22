# 错误报告：ISR 后台重校验队列缺失导致 stale 页面永不刷新（fix/isr-revalidation-queue）

日期：2026-10-22 ｜ 分支：`fix/isr-revalidation-queue` ｜ 提交：1 个

## 一、现象

线上访问 `https://smartxb.xyz/projects/codewhale` 触发 Cloudflare Worker 错误日志：

```
Failed to revalidate stale page /projects/codewhale
    at Object.send (worker.js:117390:15)
    at revalidateIfRequired (worker.js:1236:30)
    at OpenNextNodeResponse.onEnd (worker.js:1261:11)
```

请求本身返回 200，用户侧只感觉「内容像是旧的」，但日志每次命中过期页都会刷一条 error。

## 二、根因

`open-next.config.ts` 只配置了 `incrementalCache` 与 `tagCache`，**没有配置 `queue`**。`defineCloudflareConfig` 对 queue 的默认值是 `"dummy"`，而 dummy 队列的 `send()` 是直接抛错的桩实现：

```js
// node_modules/@opennextjs/aws/dist/overrides/queue/dummy.js
export default {
  name: "dummy",
  send: async () => {
    throw new FatalError("Dummy queue is not implemented");
  },
};
```

触发链路（`@opennextjs/aws/dist/core/routing/util.js` → `revalidateIfRequired`）：

1. 页面缓存条目带 `stale-while-revalidate`（`cacheLife.revalidate: 300`）语义，过期后响应头为 `x-nextjs-cache: STALE`；
2. 响应收尾时 `revalidateIfRequired` 调用 `globalThis.queue.send(...)` 安排后台重渲染；
3. `queue` 解析为 dummy → `FatalError` → 被外层 `catch` 捕获并记录 `Failed to revalidate stale page <path>`；
4. **页面从此不会被后台刷新**，只能等编辑器保存时的 `revalidateTag` 才会更新。

也就是说：这不是一条噪音日志，而是「stale 页面永久陈旧」的功能缺失。此前没有暴露，是因为项目一直靠编辑器发布触发 `revalidateTag` 主动失效，从未依赖过被动重校验。

## 三、修复

| 文件 | 改动 |
|---|---|
| `open-next.config.ts` | 新增 `queue: doQueue`（`@opennextjs/cloudflare/overrides/queue/do-queue`） |
| `wrangler.jsonc` | 新增 `durable_objects` 绑定 `NEXT_CACHE_DO_QUEUE` → `DOQueueHandler`；新增 `migrations` `v1` 的 `new_sqlite_classes: ["DOQueueHandler"]`；新增 `services` 绑定 `WORKER_SELF_REFERENCE` → `wulongblog` |
| `README.md` | 新增「ISR revalidation queue」小节，说明两个绑定缺一不可 |

选择 `doQueue` 而非 Cloudflare Queues 产品的理由：

- 只在 `waitUntil` 内做去重与重试，**不阻塞响应**，也不需要额外的队列产品配额；
- 复用 Worker 自身（`WORKER_SELF_REFERENCE`）发带 `x-prerender-revalidate` 的 `HEAD` 请求完成重渲染，无需新组件；
- `DOQueueHandler` 使用 `ctx.storage.sql`，因此必须在 `migrations` 里声明为 `new_sqlite_classes`，否则部署报「class is not SQLite-backed」。

## 四、验证

`npm run cf:build` + `wrangler dev`（真实 workerd + 远程 D1），为缩短等待把 `cacheLife.revalidate` 临时改为 5 秒，验证后已还原为 300 并重新构建：

| 观测点 | 修复前 | 修复后 |
|---|---|---|
| 首次请求 | `MISS` | `MISS` |
| 过期后请求 | `STALE`，日志报 `Failed to revalidate stale page` | `STALE`，无错误日志 |
| 再过 3 秒请求 | **仍 `STALE`（永不刷新）** | **`HIT`（后台重校验已落盘）** |
| Worker 启动绑定 | 无 `NEXT_CACHE_DO_QUEUE` | `NEXT_CACHE_DO_QUEUE (DOQueueHandler) local`、`WORKER_SELF_REFERENCE (wulongblog) local [connected]` |

其余检查：`npm run cf:build` 通过（产出 `.open-next/worker.js`，构建产物中 `queue: do_queue_default` 已生效）；`npm test` 99 pass / 0 fail。

## 五、量化指标

| 指标 | 修复前 | 修复后 |
|---|---|---|
| stale 页面被动刷新 | **不可能**（`send()` 必抛错） | 后台重校验后 **3 秒内**转为 `HIT` |
| 每次 stale 命中的 error 日志 | 1 条 `Failed to revalidate stale page` | **0 条** |
| 内容陈旧窗口（无编辑器操作） | 无限（直到下次 `revalidateTag`） | ≤ `revalidate`(300s) + 重校验耗时 |
| 需要新增的外部依赖 | — | 0（DO + 服务绑定，无额外队列产品） |
| 每次 stale 命中的响应耗时影响 | — | 0（走 `waitUntil`，响应不等待） |

## 六、遗留项与风险

- **必须在 Cloudflare 面板确认两个绑定存在**：`NEXT_CACHE_DO_QUEUE`（Durable Object）与 `WORKER_SELF_REFERENCE`（Service）。任一缺失会退回无绑定状态，日志会重新出现。`v1` 迁移只有在 `wrangler deploy` 时才会应用（见第七节），`versions upload` 不会创建 DO 类。
- `WORKER_SELF_REFERENCE.service` 与 `wrangler.jsonc` 的 `name` 强耦合，改名 Worker 时必须同步修改。
- 若未来改用 Cloudflare Queues 产品替代 DO（高并发写入场景才需要），需同时调整 `queue` 配置与 `wrangler.jsonc` 的 `queues` 段，并把 `consumers` 指向本 Worker。

## 七、部署阶段暴露的新问题

首次部署（Workers Builds）在 build 成功后失败：

```
Executing user deploy command: npx wrangler versions upload
✘ [ERROR] This Worker has a pending Durable Object migration, which cannot be applied by
  `wrangler versions upload`. Durable Object migrations must be applied with `wrangler deploy`.
  Run `wrangler deploy` to apply the migration, then retry `wrangler versions upload`.
```

**根因（初版判断错误，已修正）**：不是有人把 Deploy command 改成了 `versions upload`。Cloudflare Workers Builds 有两条彼此独立的命令：

| 命令 | 运行范围 | 本项目取值 |
|---|---|---|
| Deploy command | 仅生产分支 | `npx wrangler deploy`（用户确认从未改动） |
| Preview command | 所有非生产分支 | `npx wrangler versions upload` |

来源：<https://developers.cloudflare.com/workers/ci-cd/builds/configuration/> —「Preview builds run for branches that are not your production branch」「If you change this command to `npx wrangler versions upload`, the build creates a Worker version and Version URL」。

本次构建的分支是 `fix/isr-revalidation-queue`（非生产分支），因此执行的是 Preview command，而不是 Deploy command。而 `versions upload` 只上传版本、不应用 DO 迁移，所以**任何带 pending migration 的功能分支构建都必然失败**，与配置是否正确无关。

处理方式（不改代码、也不改任何面板配置）：

- **合并本 PR 到生产分支**，由生产分支的 Deploy command（`npx wrangler deploy`）应用 `v1` 并创建 `DOQueueHandler`；
- 或先在本地 `npx wrangler deploy` 跑一次应用 `v1`，线上立刻恢复，随后 PR 预览构建也会重新变绿。

`v1` 应用后，后续功能分支的 `versions upload` 预览构建恢复正常，除非再新增 migration tag。

同时确认构建日志里那段警告是良性的：

```
A DurableObjectNamespace in the config referenced the class "DOQueueHandler",
but no such Durable Object class is exported from the worker.
```

它出现在 `next build` 阶段（此时 `.open-next/worker.js` 尚未生成，wrangler 读的是占位入口）。打包完成后 `.open-next/worker.js` 第 10 行确实导出：

```js
export { DOQueueHandler } from "./.build/durable-objects/queue.js";
```

`npx wrangler deploy --dry-run` 也确认全部绑定解析成功：`NEXT_CACHE_DO_QUEUE (DOQueueHandler) Durable Object`、`WORKER_SELF_REFERENCE (wulongblog) Worker`、`NEXT_INC_CACHE_KV`、`MYBLOG_DB`、`NEXT_TAG_CACHE_D1`。

| 指标 | 修复前（本次部署） | 修复后 |
|---|---|---|
| 部署结果 | build 成功、preview 阶段失败（exit 1） | 生产分支 deploy 应用迁移后完成 |
| 线上 DO 类 | 未创建，队列不可用 | `DOQueueHandler` 已创建 |
| stale 页面重校验 | 仍不生效 | 生效 |
| 功能分支预览构建 | 带 pending migration 时必然失败 | `v1` 落地后恢复正常 |


## 八、流程事故记录

本次修复的第一版被错误地直接提交到了 `main`（提交 `9eefdae`，未推送）。已通过 `git reset HEAD~1`（mixed reset，保留工作区改动）撤回，`main` 回到 `7fb6635`（即 `origin/main`），改动整体迁移到本分支 `fix/isr-revalidation-queue` 重新提交。

约束（后续必须遵守）：**任何修改都先建分支，禁止在 `main` 上 commit**；`main` 只作为集成与评审面。
