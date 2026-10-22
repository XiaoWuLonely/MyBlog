# 排障报告：Cloudflare Workers Builds 自动部署失败

日期：2026-10-22 ｜ Worker：`wulongblog` ｜ 仓库：`XiaoWuLonely/MyBlog`（maintenance/cpu-perf 分支）

## 一、问题概览

Cloudflare Workers Builds（GitHub 集成）在 push PR 后自动触发构建，**4 次失败、持续约 2.5 小时**才最终跑通。问题不在代码本身（本地 `npm run cf:build` 全程一次过），全部出在 **Cloudflare Build image 的工具链与项目构建规范的版本差异 + 面板配置误操作** 上。

## 二、错误时间线

### ❌ 构建 1 — 0s 内秒挂
日志无（Cloudflare 没跑完 install 就挂），错误信息只在 PR 注释里露一行。

**根因**：Cloudflare Builds 面板没有显式配置 Build command，自动检测猜不到 OpenNext 框架。Deploy `npx wrangler deploy` 找不到 `.open-next/worker.js`，秒挂。

### ❌ 构建 2 — `ERR_PNPM_PACKAGES_MISSING`
```
Detected the following tools: nodejs@24.15.0, pnpm@9.10.0, npm@10.9.2
Installing project dependencies: pnpm install --frozen-lockfile
ERROR packages field missing or empty
```

**根因**：Cloudflare Build image 默认装 pnpm 9.10，pnpm 9 强制要求 `pnpm-workspace.yaml` 里有 `packages:` 字段（pnpm 10+ 才会自动推断单包仓库不需要显式 packages）。本项目是单包仓库，workspace.yaml 里根本没写这个 key → pnpm 9 直接报错。

**修复**：在 `pnpm-workspace.yaml` 顶部加 `packages: []`（空数组表示单包仓库）。pnpm 12 本地测试确认不受影响。

### ❌ 构建 3 — `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`
```
ERR_PNPM_LOCKFILE_CONFIG_MISMATCH  Cannot proceed with the frozen installation.
The current "patchedDependencies" configuration doesn't match the value found in the lockfile
```

**根因**：Cloudflare 仍然跑的 pnpm 9（你以为 PNPM_VERSION 变量生效了，实际没生效——详见构建 4）。pnpm 9 能读懂 `pnpm-workspace.yaml#patchedDependencies` 这个 key，但 frozen install 要求锁文件里记录的 hash 与当前 workspace.yaml 声明完全一致。锁文件是本地 pnpm 12 生成的，pnpm 9 读出来不一样 → 拒绝 frozen install。

**我当时的错误尝试**：试图通过 `pnpm-lock.yaml` 删掉重生成、或者同时在 `package.json#pnpm.patches` 再写一份来"对齐 pnpm 9 的格式"，但 pnpm 12 只认 workspace.yaml 不认 package.json#pnpm（这俩声明同时存在反而触发 ERR_PNPM_UNUSED_PATCH）。

### ❌ 构建 4 — 根因：PNPM_VERSION 变量**根本没进 Build image**
前面三次构建，Cloudflare 日志里始终是 `pnpm@9.10.0`，根本没变成我期望的 12.4.2。原因是 **Cloudflare Dashboard 里有两个完全独立的变量面板，我让你加到错的那个了**：

| 面板 | 路径 | 变量作用域 |
|---|---|---|
| **构建变量（Build variables）** ✅ 正确 | Settings → **Builds** → 页面**下半块**独立区块叫「构建变量和密钥」 | 传给 Build image（工具链初始化时就能看到） |
| **运行时变量（Runtime variables）** ❌ 你之前加错的 | Settings → **Variables and secrets**（另一个 tab） | 只在 Worker 运行时可见，Build image 完全看不到 |

你把 `PNPM_VERSION` 加到了运行时面板，所以 Build image 始终看到默认值 pnpm 9.10。

### ✅ 构建 5 — 成功
Build variables 面板加对 `PNPM_VERSION=12.4.2`（类型选「变量」，不是「密钥」；值填 `12.4.2`，不是 `"PNPM_VERSION"`），Cloudflare 自动重试这次构建成功。

## 三、最终面板配置对照表

Cloudflare Dashboard → Workers → wulongblog → **Settings → Builds**

### 构建配置

| 字段 | 正确值 | 易错坑 |
|---|---|---|
| Build command | `npm run cf:build` | ❌ 不能留空（自动检测不会猜 OpenNext）；❌ 不能写成 Next 默认的 `npm run build`（不生成 `.open-next/worker.js`） |
| Deploy command | `npx wrangler deploy` | ❌ 不能写成 `npx opennextjs-cloudflare deploy`（OpenNext 没有 deploy 子命令，它只负责 build，产物还是 wrangler 来部署） |
| Version command | 留空 | Cloudflare 会自动选 |
| Root directory | 留空 | 项目就在仓库根 |

### 构建变量（Build variables，不是 Runtime variables）

| Name | Value | Secret |
|---|---|---|
| `PNPM_VERSION` | `12.4.2` | ❌ 关（版本号不是敏感信息） |

### 运行时变量（Runtime variables，另一个 tab）

Cloudflare 自动生成的绑定（`MYBLOG_FILE_STORAGE` 等）在这里，**不要在这里建 PNPM_VERSION**。

## 四、为什么 Linux Cloudflare 构建不需要我的 OpenNext pnpm patch

我打给 `@opennextjs/aws@4.1.4` 的 patch 只解决一个问题：**Windows 无开发者模式时 `copyTracedFiles` 无法建 symlink，且 pnpm 的 Windows junction 是绝对路径指回项目源 store，导致构建产物绕过打在输出树副本上的代码补丁**。

Cloudflare 构建环境是 Linux，pnpm 在 Linux 上建的是相对 symlink（`..` 开头），OpenNext 原始 copyTracedFiles 代码能 100% 正常工作 → 这个 patch 在 Cloudflare 上是死代码，不需要生效也不会炸。我甚至可以把它从 workspace.yaml 里去掉，Cloudflare 构建不会有任何变化。**保留它纯粹是为了 Windows 本地构建的稳定性**。

## 五、教训与未来预防

| 坑 | 下次怎么防 |
|---|---|
| pnpm 版本差异 | 每次 Cloudflare Builds 构建都要先核对 Build image 里实际装了什么（看日志第一行 Detected...），不要假设你在 Build variables 里设的就生效了 |
| Cloudflare 变量面板搞混 | 记住 **Build variables 在 Builds tab 里、Runtime variables 在独立 Variables and secrets tab**，两者作用域完全不同 |
| OpenNext 不被自动检测 | 项目用 OpenNext adapter 时，**必须手动在 Builds 面板填 Build command**（`npm run cf:build`），Deploy command 保持 Cloudflare 默认的 `npx wrangler deploy` |
| pnpm-workspace.yaml 的 packages 字段 | 从 pnpm 10 开始才自动推断单包仓库。如果项目要兼容 pnpm 9（Cloudflare 默认），必须显式写 `packages: []` |
| Build command 不能瞎猜 | `opennextjs-cloudflare deploy` 命令根本不存在，OpenNext 只提供 `build` 和 `preview` 子命令 |

## 六、当前状态

- 维护分支 `maintenance/cpu-perf` 8 个 commit 全部推 GitHub（`5f0f4e3..8ba8a80`）
- Cloudflare PR preview 构建已通过
- 等待 **Squash and merge** 进 main → Cloudflare 自动触发生产部署 → 上线后 `wrangler tail` 观察线上是否还刷 `Worker exceeded CPU time limit`
- 上线确认后，`pnpm-workspace.yaml` 里的 Windows-only OpenNext patch 可以考虑抽成单独的 `dev:windows-patch` 脚本，让 CI 更干净
