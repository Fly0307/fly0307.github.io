# UnlearnedMan · Orbital Archive

这是 UnlearnedMan 的个人主页与 Markdown 博客。站点使用 Astro 生成静态文件，并发布到 [https://fly0307.github.io/](https://fly0307.github.io/)。

## 本地开发

首次在本地运行：

```sh
npm install
npm run dev
```

开发服务器会输出本地预览地址。提交前请运行完整发布验证：

```sh
npm test
```

该命令依次执行 Astro 与内容校验、生产构建、单元测试和生成站点测试。也可以分别执行：

```sh
npm run check       # 校验 Astro、TypeScript 和文章元数据
npm run test:unit   # 校验内容、语言、筛选和动效逻辑
npm run build       # 生成 dist/ 生产站点
npm run test:static # 校验生成后的 HTML、RSS、站点地图和安全约束
```

持续集成使用 `npm ci`，以 `package-lock.json` 固定依赖版本。`dist/`、`node_modules/` 与 `.astro/` 都是生成目录，不能提交到仓库。

## 发布博客文章

所有文章位于 `src/content/blog/`。从 `src/content/blog/blog-template.md` 复制一份为新的 Markdown 文件，例如：

```text
src/content/blog/mobiagent-notes.md
```

文件名会生成稳定链接 `/blog/mobiagent-notes/`。在 frontmatter 中填写并检查以下字段：

```markdown
---
title: "文章标题"
description: "用于归档和搜索引擎的简短摘要"
publishedAt: 2026-08-28
updatedAt: 2026-08-28 # 可选
language: zh
tags: ["Agent", "Systems"]
draft: false
featured: true
---
```

- `language` 只能是 `zh` 或 `en`。每篇文章只使用一种源语言；界面的中英切换不会翻译文章正文。
- `draft: true` 的文章不会进入公开归档、RSS、站点地图或主页。
- `featured: true` 的已发布文章可以显示在主页的“最新传输记录”区域；文章仍按发布日期排序。
- 先执行 `npm run dev` 预览文章，再执行 `npm test`。通过后提交 Markdown 文件并推送。

不要修改 `blog-template.md` 的 `draft: true` 状态；它只是写作模板，永远不会生成公开文章页面。

## GitHub Pages 部署

部署工作流位于 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)。它只构建并上传 `dist/`，不会部署源代码或本地开发文件。

首次启用时，请在 GitHub 仓库中设置：**Settings → Pages → Source → GitHub Actions**。这是用户主页仓库，因此站点根地址固定为 [https://fly0307.github.io/](https://fly0307.github.io/)，不使用仓库名作为路径前缀。

之后有两种发布方式：

1. 将通过验证的提交推送到 `main`。
2. 在 GitHub 的 **Actions** 页面手动运行 “Deploy Astro site to GitHub Pages”。

同一时间仅保留最新一次 Pages 部署，较早的未完成部署会自动取消。每次部署都会安装锁定依赖、校验内容、运行测试、构建站点，然后上传唯一的 `dist/` artifact。

## 维护边界

公开身份信息仅维护为 UnlearnedMan、上海交通大学本科与硕士教育经历、`fly0307@sjtu.edu.cn`，以及已确认的 MobiAgent 和 Penglai 项目信息。请勿添加未经确认的姓名、院系、日期、职称、论文或贡献声明。

旧作者内容、旧主页链接和旧 Gitalk 配置（包括 `Dunky-Z/comment`）均不得重新引入。本站不包含评论系统、OAuth、分析或跟踪脚本。
