# WuLong 的博客

你好，我是 **WuLong**，一名学生和开发者。这是我的个人博客的源代码仓库，也是一个长期维护的学习空间——用来沉淀学习笔记、前端实践、项目复盘和有价值的资源，让零散的知识和经验可以被持续整理和回看。

**线上地址：** [smartxb.xyz](https://smartxb.xyz)

## 关于我

- 学生 / 开发者，base 在广东
- 关注前端开发、页面交互和内容型网站的长期维护
- 喜欢把学习笔记、项目实践和资源整理放进同一个清晰的工作流里
- 希望这个博客既能记录技术成长，也能留下真实的思考和复盘

**技能方向：** 学习记录 · 前端开发 · React / Next.js · 内容写作 · 项目实践

**在哪里找到我：**

- GitHub：[@LittlPenguin](https://github.com/LittlPenguin)
- 掘金：[WuLong 的主页](https://juejin.cn/user/327030668540793)
- 邮箱：[xiaowulonely23@gmail.com](mailto:xiaowulonely23@gmail.com)

**时间线：**

| 年份 | 在做什么 |
| ---- | -------- |
| 2026 | 持续整理个人博客与学习内容，把文章、项目和资源放进统一的站点结构里 |
| 2025 | 围绕 React、Next.js 和页面实现持续练习，把阶段性收获整理成可回看的内容 |
| 2024 | 开始记录学习过程，把技术笔记、资源链接和项目想法逐步沉淀下来 |

## 博客内容

站点内容分三类，全部可以在 [smartxb.xyz](https://smartxb.xyz) 上浏览：

### 📝 归档文章

学习笔记、前端实践和日常思考。目前还在起步期，内容会持续增加。

### 🗂 资源收藏

自己用过、觉得值得推荐的工具和资源，最近收录的有：

- **[Browser Use](https://smartxb.xyz/resources/browser-use)** — 让 AI Agent 用自然语言操作浏览器，告别选择器维护
- **[MarkItDown](https://smartxb.xyz/resources/markitdown)** — 微软出品的轻量工具，把 PDF、Word、图片等统一转成 Markdown
- **[Cockpit Tools](https://smartxb.xyz/resources/cockpit-tools)** — 通用 AI IDE 账号管理工具，支持 12 个平台的多账号切换
- **[Clash Rules](https://smartxb.xyz/resources/clash-rules)** — 面向 Clash Premium 内核的分流规则集
- **[CC Switch](https://smartxb.xyz/resources/cc-switch)** — 一个桌面应用统一管理多个 AI CLI 的供应商配置、MCP 和 Skills
- **[Codex++](https://smartxb.xyz/resources/codex-plus-plus)** / **[Codex Provider Sync](https://smartxb.xyz/resources/codex-provider-sync)** — Codex 生态的两个增强小工具

### 🛠 项目

历史项目都放在 GitHub（[@LittlPenguin](https://github.com/LittlPenguin)）上，正在逐步整理搬迁到本站，持续更新中。

## 本站是如何构建的

- **框架：** Next.js 16（App Router、React 19、React Compiler）
- **样式与动效：** Tailwind CSS 4 · Framer Motion
- **内容：** Markdown/MDX 正文存储在 Cloudflare D1，通过 `next-mdx-remote` 渲染，由后台编辑器直接发布
- **部署：** Cloudflare Workers（`@opennextjs/cloudflare`），KV + D1 做 ISR 缓存与标签失效，Durable Object 队列负责后台重校验
- **其他：** 亮色/暗色主题、归档页搜索与分类过滤、About 页访客留言板

---

*Built as a personal space for learning, building, and writing.*
