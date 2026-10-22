# 维护报告：Cloudflare CPU 超限与卡顿排查（maintenance/cpu-perf）

日期：2026-10-22 ｜ 分支：`maintenance/cpu-perf`（6 个提交，`5f0f4e3..284a1de`）

## 一、发现的问题

### P0 — 扫描器垃圾请求打爆 Worker CPU（线上报错根因）
线上日志中 `Worker exceeded CPU time limit` 的触发 URL 是 `/cms/wp-includes/wlwmanifest.xml`、`/wp-admin`、`/.env` 这类 WordPress 扫描器流量。这些请求以前会完整进入 Next.js 服务端渲染管线，一直消耗 CPU 直到超限。项目没有任何 proxy/middleware 层拦截。

### P0 — Windows 上 cf:build 产物全站 500（排障过程中发现的隐藏炸弹）
OpenNext 的 `copyTracedFiles` 要重建 pnpm 的 node_modules 链接。Windows 无开发者模式时建 symlink 直接 EPERM；而 pnpm 在 Windows 上的 junction 是**绝对路径指回项目源 store**，导致构建产物绕过 OpenNext 打在输出目录副本上的关键补丁（`getMiddlewareManifest → return null`），运行时抛 `Dynamic require of "/.next/server/middleware-manifest.json" is not supported`，包括 /admin、/editor 在内全站 500。Linux CI 不会遇到（相对 symlink），所以这是 Windows 本地构建特有问题。

### P1 — 每次页面渲染都直打远程 D1，无 ISR
所有公开页面每次都是动态渲染 + 远程 D1 查询（实测数据库在 SIN 区域），没有增量静态缓存，同一请求内还有重复查询。这是"切换页面卡顿"的主要服务端原因。

### P1 — PPR postponed state 在 workerd 上必然解析失败
Next 16 默认把 postponed state 解压上限设为 500MB，而 workerd 的 zlib `maxOutputLength` 上限是 128MB，每次 PPR resume 都抛 RangeError，缓存恢复静默失效。属于"不改就永远在浪费渲染"的隐性问题。

### P2 — 路由过渡动画主线程负担过重
680ms 的 enter settle 窗口、每帧 rAF 轮询 loading-shell、多属性 spring（x/scale/blur）叠加，导航期间主线程被动画占用。

### P2 — 编辑器发布链路无兜底
发布后 `revalidateTag` 失败会以 502 形式冒泡为"提交报错"，与"提交时报错"的体感一致。

## 二、实施的优化

| 提交 | 内容 |
|---|---|
| `5f0f4e3` | 新增 [src/proxy.ts](../../src/proxy.ts)：垃圾请求在 middleware 层直接返回裸 404 + 5 分钟缓存头，不进入渲染管线 |
| `df8a7f4` | React cache 请求内去重 + 列表查询瘦身 + isolate 级 60s TTL 读穿缓存（[d1-cache.ts](../../src/lib/d1-cache.ts)） |
| `ac36571` | ISR 静态化：KV incremental cache + D1 tag cache 账本 + `use cache` 包装层（[cached-content.ts](../../src/lib/cached-content.ts)）+ 公开页面 Suspense 化 |
| `3950d39` | 过渡动画减负：rAF 轮询改 MutationObserver、settle 窗口缩短、spring 轨道精简 |
| `23043ad` | 发布链路 502 兜底（revalidate 失败不再表现为提交失败）+ README 同步 |
| `284a1de` | pnpm patch 修复 Windows 构建（junction 重定向到输出树内已打补丁的 `.pnpm` 副本）；`maxPostponedStateSize: "20 MB"` 适配 workerd 128MB 上限 |

## 三、量化指标（wrangler dev + 远程 D1 实测）

### 垃圾请求拦截
| 路径 | 优化前 | 优化后 |
|---|---|---|
| `/wp-admin` | 进入渲染管线直至 CPU 超限报错 | 404，**14ms** |
| `/cms/wp-includes/wlwmanifest.xml`（日志同款） | 同上 | 404，**6ms** |

该类流量的 Worker CPU 消耗降为接近零。

### 页面二次访问（ISR 生效）
| 路由 | 首次 | 二次 | 降幅 |
|---|---|---|---|
| `/` | 3401ms | 940ms | **-72%**（`x-nextjs-cache: HIT`） |
| `/archive` | 2421ms | 1275ms | -47% |
| `/projects` | 3246ms | 743ms | **-77%** |
| `/about` | 2505ms | 667ms | **-73%**（`x-nextjs-cache: HIT`） |

### 动画
- enter settle 窗口 680ms → 260ms（**-62%**）
- 删除每帧 rAF 轮询，loading-shell 检测改为事件驱动

### 质量关卡
- 测试 129/129 通过
- lint 9 errors / 3 warnings，全部为主分支存量（基线 10 errors / 82 warnings，零新增且有改善）
- typecheck / build / cf:build 全部通过

## 四、遗留事项
- 发布文章后 revalidateTag 刷新的端到端手测、about 留言提交、admin Suspense 按钮 UI 确认
- `cf:deploy` 上线 + wrangler tail 线上观察（需用户确认后执行）
