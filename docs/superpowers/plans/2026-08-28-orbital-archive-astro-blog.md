# Orbital Archive Astro Blog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current minimal static homepage with an Astro-built bilingual “Orbital Archive” portfolio and a validated single-language-per-post Markdown blog deployed through GitHub Pages Actions.

**Architecture:** Astro 6 generates all public routes as static HTML. Pages query one validated `blog` content collection, pass plain data into focused presentation components, and enhance the rendered HTML with independent language, filtering, starfield, reveal, parallax, and scroll-progress modules. GitHub Actions checks source and content, builds `dist/`, tests the generated contract, and publishes only that artifact.

**Tech Stack:** Astro 6.3.1, TypeScript, Astro content collections, Markdown, `@astrojs/rss`, `@astrojs/sitemap`, CSS, Canvas 2D, native browser APIs, Node test runner through `tsx`, GitHub Actions, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-08-28-orbital-archive-astro-blog-design.md`

## Global Constraints

- Public site URL is exactly `https://fly0307.github.io/`; this user-site repository uses root base path `/`.
- Public identity is limited to `UnlearnedMan`, Shanghai Jiao Tong University undergraduate/master’s education, `fly0307@sjtu.edu.cn`, and confirmed project information.
- MobiAgent links to `https://github.com/Fly0307/MobiAgent`; Penglai links to `https://penglai-enclave.systems/`.
- The interface is bilingual Chinese/English; each post has exactly one source language, `zh` or `en`, and is never auto-translated.
- Do not restore Dominic’s posts, identity, homepage links, Fluid theme assets, Gitalk, `Dunky-Z/comment`, OAuth values, analytics, or tracking.
- Do not add unconfirmed real name, department, dates, job title, publications, or project contribution claims.
- Do not add React, Vue, Three.js, WebGL, a database, a CMS, comments, authentication, full-text search, external fonts, icon CDNs, or third-party runtime scripts.
- Motion must be progressive enhancement and must stop for `prefers-reduced-motion: reduce`, hidden documents, and off-screen canvases.
- Core navigation, project links, blog lists, and post bodies must remain usable when JavaScript is unavailable.
- Use npm and commit `package-lock.json`; do not commit `dist/`, `node_modules/`, `.astro/`, or `.superpowers/`.
- Every implementation task follows TDD, passes its focused checks, and ends in a standards-compliant local commit.
- Do not push or change GitHub repository settings without explicit user authorization.

---

## Planned File Structure

```text
.
├── .github/workflows/deploy.yml        # GitHub Pages build and deploy pipeline
├── astro.config.mjs                    # Static output, canonical site, sitemap
├── package.json                        # Development, check, build, and test scripts
├── package-lock.json                   # Reproducible npm dependency lock
├── tsconfig.json                       # Astro strict TypeScript configuration
├── public/
│   ├── img/hero-space.png              # User-provided hero image
│   └── robots.txt                      # Sitemap discovery and crawl policy
├── src/
│   ├── content.config.ts               # Blog collection loader and schema
│   ├── content/blog/_template.md       # Ignored, non-published authoring template
│   ├── data/site.ts                    # Confirmed bilingual identity/project data
│   ├── layouts/
│   │   ├── BaseLayout.astro            # Metadata, navigation, footer, language bootstrap
│   │   └── PostLayout.astro            # Post header, TOC, body, adjacent navigation
│   ├── components/
│   │   ├── SiteHeader.astro
│   │   ├── SiteFooter.astro
│   │   ├── Hero.astro
│   │   ├── ResearchOrbit.astro
│   │   ├── ProjectMissions.astro
│   │   ├── LatestTransmissions.astro
│   │   ├── ProfileSection.astro
│   │   ├── PostCard.astro
│   │   ├── PostMeta.astro
│   │   ├── TagList.astro
│   │   ├── Starfield.astro
│   │   └── OrbitalProgress.astro
│   ├── lib/
│   │   ├── post-schema.ts              # Reusable frontmatter validation schema
│   │   └── posts.ts                    # Published filtering, ordering, tags, reading time
│   ├── pages/
│   │   ├── index.astro
│   │   ├── 404.astro
│   │   ├── rss.xml.ts
│   │   └── blog/
│   │       ├── index.astro
│   │       └── [...slug].astro
│   ├── scripts/
│   │   ├── language.ts
│   │   ├── blog-filter.ts
│   │   ├── motion-policy.ts
│   │   ├── starfield.ts
│   │   ├── section-reveal.ts
│   │   ├── orbital-progress.ts
│   │   └── hero-parallax.ts
│   └── styles/
│       ├── tokens.css
│       ├── global.css
│       ├── layout.css
│       ├── components.css
│       ├── blog.css
│       └── motion.css
└── tests/
    ├── project-contract-test.mjs
    ├── site-static-test.mjs
    ├── deployment-contract-test.mjs
    ├── content-model.test.ts
    ├── language.test.ts
    ├── blog-filter.test.ts
    └── motion-policy.test.ts
```

The existing root `index.html`, `404.html`, `css/site.css`, `js/site.js`, `.nojekyll`, and `img/hero-space.png` are transitional inputs. They are removed only after their Astro replacements pass generated-site tests.

---

### Task 1: Establish the Astro Build Contract

**Files:**
- Create: `tests/project-contract-test.mjs`
- Create: `package.json`
- Create: `package-lock.json`
- Create: `astro.config.mjs`
- Create: `tsconfig.json`
- Create: `src/pages/index.astro`
- Create: `public/img/hero-space.png` by moving the existing binary
- Modify: `.gitignore`

**Interfaces:**
- Consumes: existing `img/hero-space.png` and the canonical URL from the spec.
- Produces: npm scripts `dev`, `check`, `build`, `test:unit`, `test:static`, and `test`; Astro static output in `dist/`; public image URL `/img/hero-space.png`.

- [ ] **Step 1: Write the failing project contract test**

Create `tests/project-contract-test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('Astro build contract targets the GitHub user site', async () => {
  const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
  const config = await readFile(new URL('astro.config.mjs', root), 'utf8');

  assert.equal(pkg.private, true);
  assert.equal(pkg.scripts.dev, 'astro dev');
  assert.equal(pkg.scripts.check, 'astro check');
  assert.equal(pkg.scripts.build, 'astro build');
  assert.match(config, /site:\s*['"]https:\/\/fly0307\.github\.io['"]/);
  assert.match(config, /output:\s*['"]static['"]/);
  assert.match(config, /trailingSlash:\s*['"]always['"]/);
});
```

- [ ] **Step 2: Run the test and verify the missing scaffold fails**

Run: `node --test tests/project-contract-test.mjs`

Expected: FAIL with `ENOENT` for `package.json` or `astro.config.mjs`.

- [ ] **Step 3: Create the Astro package and configuration files**

Create `package.json` with these scripts and dependency ranges; `npm install` must resolve and commit the exact lockfile:

```json
{
  "name": "fly0307-github-io",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "check": "astro check",
    "build": "astro build",
    "test:unit": "tsx --test tests/*.test.ts",
    "test:static": "node --test tests/*-test.mjs",
    "test": "npm run check && npm run build && npm run test:unit && npm run test:static"
  },
  "dependencies": {
    "@astrojs/rss": "^4.0.0",
    "@astrojs/sitemap": "^3.0.0",
    "astro": "6.3.1"
  },
  "devDependencies": {
    "@astrojs/check": "^0.9.0",
    "tsx": "^4.0.0",
    "typescript": "^5.9.0"
  }
}
```

Create `astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://fly0307.github.io',
  output: 'static',
  trailingSlash: 'always',
  integrations: [sitemap()],
});
```

Create `tsconfig.json`:

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

Run: `npm install`

Expected: `package-lock.json` is created and Astro 6.3.1 is locked.

- [ ] **Step 4: Add a minimal buildable Astro page and public image**

Move `img/hero-space.png` to `public/img/hero-space.png`. Create `src/pages/index.astro`:

```astro
---
const title = 'UnlearnedMan';
---
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>{title}</title>
  </head>
  <body>
    <main>
      <h1>{title}</h1>
      <img src="/img/hero-space.png" alt="白色火箭位于发射架旁的星空场景" />
    </main>
  </body>
</html>
```

Append only these generated paths to `.gitignore` if absent:

```gitignore
node_modules/
dist/
.astro/
.superpowers/
```

- [ ] **Step 5: Verify the contract and first static build**

Run: `node --test tests/project-contract-test.mjs && npm run check && npm run build`

Expected: all commands PASS; `dist/index.html` and `dist/img/hero-space.png` exist.

- [ ] **Step 6: Commit the Astro build foundation**

```bash
git add package.json package-lock.json astro.config.mjs tsconfig.json .gitignore src/pages/index.astro public/img/hero-space.png tests/project-contract-test.mjs img/hero-space.png
git commit -m "chore(site): 建立 Astro 静态构建基础"
```

---

### Task 2: Define and Test the Blog Content Domain

**Files:**
- Create: `src/lib/post-schema.ts`
- Create: `src/content.config.ts`
- Create: `src/lib/posts.ts`
- Create: `src/content/blog/_template.md`
- Create: `tests/content-model.test.ts`

**Interfaces:**
- Consumes: Astro content loader and Markdown files under `src/content/blog/` whose names do not begin with `_`.
- Produces: `postSchema`; `PostLanguage`, `PostData`, and `PostRecord` types; `getPublishedPosts(posts)`, `selectHomepagePosts(posts, limit)`, `estimateReadingMinutes(body)`, and `normalizeTag(tag)`.

- [ ] **Step 1: Write failing schema and post-selection tests**

Create `tests/content-model.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { postSchema } from '../src/lib/post-schema.ts';
import {
  estimateReadingMinutes,
  getPublishedPosts,
  normalizeTag,
  selectHomepagePosts,
  type PostRecord,
} from '../src/lib/posts.ts';

const post = (
  id: string,
  publishedAt: string,
  featured = false,
  draft = false,
): PostRecord => ({
  id,
  body: 'test body',
  data: {
    title: id,
    description: `${id} description`,
    publishedAt: new Date(publishedAt),
    language: 'en',
    tags: [],
    draft,
    featured,
  },
});

test('schema accepts one explicit source language and defaults optional flags', () => {
  const result = postSchema.parse({
    title: 'Penglai Notes',
    description: 'Notes about trusted execution environments.',
    publishedAt: '2026-08-28',
    language: 'en',
  });
  assert.equal(result.language, 'en');
  assert.deepEqual(result.tags, []);
  assert.equal(result.draft, false);
  assert.equal(result.featured, false);
});

test('schema rejects invalid language and an update before publication', () => {
  assert.equal(postSchema.safeParse({
    title: 'Bad language', description: 'x', publishedAt: '2026-08-28', language: 'fr',
  }).success, false);
  assert.equal(postSchema.safeParse({
    title: 'Bad dates', description: 'x', publishedAt: '2026-08-28',
    updatedAt: '2026-08-27', language: 'zh',
  }).success, false);
});

test('drafts are excluded and featured posts lead the homepage selection', () => {
  const posts = [
    post('newest', '2026-08-28'),
    post('featured', '2026-08-20', true),
    post('draft', '2026-08-29', true, true),
    post('older', '2026-08-10'),
  ];
  assert.deepEqual(getPublishedPosts(posts).map(({ id }) => id), ['newest', 'featured', 'older']);
  assert.deepEqual(selectHomepagePosts(posts, 3).map(({ id }) => id), ['featured', 'newest', 'older']);
});

test('tag and reading-time helpers are deterministic', () => {
  assert.equal(normalizeTag('  Trusted Execution  '), 'trusted execution');
  assert.equal(estimateReadingMinutes('hello world'), 1);
  assert.equal(estimateReadingMinutes('研'.repeat(601)), 3);
});
```

- [ ] **Step 2: Run the content tests and verify missing modules fail**

Run: `npx tsx --test --test-name-pattern="schema|drafts|tag" tests/content-model.test.ts`

Expected: FAIL because `post-schema.ts` and `posts.ts` do not exist.

- [ ] **Step 3: Implement the reusable frontmatter schema**

Create `src/lib/post-schema.ts`:

```ts
import { z } from 'astro/zod';

export const postSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  publishedAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
  language: z.enum(['zh', 'en']),
  tags: z.array(z.string().trim().min(1)).default([]),
  draft: z.boolean().default(false),
  featured: z.boolean().default(false),
}).superRefine((value, context) => {
  if (value.updatedAt && value.updatedAt < value.publishedAt) {
    context.addIssue({
      code: 'custom',
      path: ['updatedAt'],
      message: 'updatedAt must be on or after publishedAt',
    });
  }
});

export type PostData = z.infer<typeof postSchema>;
export type PostLanguage = PostData['language'];
```

Create `src/content.config.ts`:

```ts
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { postSchema } from './lib/post-schema';

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/[^_]*.md' }),
  schema: postSchema,
});

export const collections = { blog };
```

- [ ] **Step 4: Implement pure post-domain helpers**

Create `src/lib/posts.ts`:

```ts
import type { PostData } from './post-schema';

export interface PostRecord {
  id: string;
  data: PostData;
  body?: string;
}

const newestFirst = (a: PostRecord, b: PostRecord) =>
  b.data.publishedAt.getTime() - a.data.publishedAt.getTime();

export function getPublishedPosts<T extends PostRecord>(posts: T[]): T[] {
  return posts.filter((post) => !post.data.draft).sort(newestFirst);
}

export function selectHomepagePosts<T extends PostRecord>(posts: T[], limit = 3): T[] {
  return getPublishedPosts(posts).sort((a, b) =>
    Number(b.data.featured) - Number(a.data.featured) || newestFirst(a, b)
  ).slice(0, limit);
}

export function normalizeTag(tag: string): string {
  return tag.trim().normalize('NFKC').toLocaleLowerCase('en-US');
}

export function estimateReadingMinutes(body = ''): number {
  const cjk = body.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  const latin = body.replace(/[\u3400-\u9fff]/g, ' ').match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
  return Math.max(1, Math.ceil((cjk + latin) / 300));
}
```

- [ ] **Step 5: Add the ignored, non-published Markdown template**

Create `src/content/blog/_template.md`:

```markdown
---
title: "文章标题 / Post title"
description: "用于列表和搜索引擎的简短摘要 / Short summary"
publishedAt: 2026-08-28
language: zh
tags: []
draft: true
featured: false
---

# 开始写作

将文件复制为不以下划线开头的名称，选择 `zh` 或 `en`，完成后把 `draft` 改为 `false`。
```

- [ ] **Step 6: Run focused and framework checks**

Run: `npm run test:unit && npm run check`

Expected: all four content-domain tests PASS; Astro reports no collection configuration errors; the template is ignored by the glob loader.

- [ ] **Step 7: Commit the content domain**

```bash
git add src/content.config.ts src/content/blog/_template.md src/lib/post-schema.ts src/lib/posts.ts tests/content-model.test.ts
git commit -m "feat(blog): 定义 Markdown 文章内容模型"
```

---

### Task 3: Build the Bilingual Base Layout

**Files:**
- Create: `src/data/site.ts`
- Create: `src/layouts/BaseLayout.astro`
- Create: `src/components/SiteHeader.astro`
- Create: `src/components/SiteFooter.astro`
- Create: `src/scripts/language.ts`
- Create: `src/styles/tokens.css`
- Create: `src/styles/global.css`
- Create: `src/styles/layout.css`
- Create: `tests/language.test.ts`
- Delete: `tests/site-language-test.mjs` after its assertions move to the TypeScript test
- Modify: `src/pages/index.astro`

**Interfaces:**
- Consumes: `BaseLayout` props `{ title?: string; description?: string; contentLanguage?: 'zh' | 'en' }`.
- Produces: `resolveLanguage(storedLanguage, browserLanguage)`, `nextLanguage(language)`, `applyInterfaceLanguage(language)`, and `initializeLanguage()`; stable `data-zh` and `data-en` markup contract.

- [ ] **Step 1: Write failing pure language tests**

Create `tests/language.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { nextLanguage, resolveLanguage } from '../src/scripts/language.ts';

test('stored interface language wins over browser language', () => {
  assert.equal(resolveLanguage('zh', 'en-US'), 'zh');
  assert.equal(resolveLanguage('en', 'zh-CN'), 'en');
});

test('browser language is used when storage is absent or invalid', () => {
  assert.equal(resolveLanguage(null, 'zh-TW'), 'zh');
  assert.equal(resolveLanguage('invalid', 'en-GB'), 'en');
});

test('language toggle alternates between supported values', () => {
  assert.equal(nextLanguage('zh'), 'en');
  assert.equal(nextLanguage('en'), 'zh');
});
```

- [ ] **Step 2: Run the test and verify the missing language module fails**

Run: `npx tsx --test --test-name-pattern="stored|browser|toggle" tests/language.test.ts`

Expected: FAIL because `src/scripts/language.ts` does not exist.

- [ ] **Step 3: Implement the language module with storage failure fallback**

Create `src/scripts/language.ts` with this public surface and browser initialization:

```ts
export type InterfaceLanguage = 'zh' | 'en';
export const languageStorageKey = 'unlearnedman-language';

export function resolveLanguage(storedLanguage: string | null, browserLanguage: string): InterfaceLanguage {
  if (storedLanguage === 'zh' || storedLanguage === 'en') return storedLanguage;
  return browserLanguage.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function nextLanguage(language: InterfaceLanguage): InterfaceLanguage {
  return language === 'zh' ? 'en' : 'zh';
}

export function applyInterfaceLanguage(language: InterfaceLanguage): void {
  document.documentElement.dataset.lang = language;
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  const toggle = document.querySelector<HTMLButtonElement>('[data-language-toggle]');
  if (toggle) {
    toggle.textContent = language === 'zh' ? '切换至英文' : 'Switch to Chinese';
    toggle.ariaLabel = toggle.textContent;
  }
  document.querySelectorAll<HTMLImageElement>('[data-alt-zh][data-alt-en]').forEach((image) => {
    image.alt = language === 'zh' ? image.dataset.altZh ?? '' : image.dataset.altEn ?? '';
  });
}

export function initializeLanguage(): void {
  let stored: string | null = null;
  try { stored = localStorage.getItem(languageStorageKey); } catch { stored = null; }
  applyInterfaceLanguage(resolveLanguage(stored, navigator.language));
  document.querySelector<HTMLButtonElement>('[data-language-toggle]')?.addEventListener('click', () => {
    const current = document.documentElement.dataset.lang === 'zh' ? 'zh' : 'en';
    const selected = nextLanguage(current);
    applyInterfaceLanguage(selected);
    try { localStorage.setItem(languageStorageKey, selected); } catch { /* current page still updates */ }
  });
}
```

- [ ] **Step 4: Create confirmed site data and semantic shell components**

Create `src/data/site.ts` with only these confirmed values:

```ts
export const site = {
  name: 'UnlearnedMan',
  canonicalUrl: 'https://fly0307.github.io',
  email: 'fly0307@sjtu.edu.cn',
  github: 'https://github.com/Fly0307',
  projects: [
    {
      name: 'MobiAgent',
      url: 'https://github.com/Fly0307/MobiAgent',
      zh: '聚焦移动设备智能 GUI Agent。',
      en: 'Focuses on intelligent GUI agents for mobile devices.',
    },
    {
      name: 'Penglai',
      url: 'https://penglai-enclave.systems/',
      zh: '面向 RISC-V 的开源、可扩展可信执行环境系统。',
      en: 'An open-source, scalable trusted execution environment system for RISC-V.',
    },
  ],
} as const;
```

Implement `SiteHeader.astro` with anchors `/#projects`, `/blog/`, `/#about`, and the `data-language-toggle` button. Implement `SiteFooter.astro` with UnlearnedMan, GitHub, email, and build-time year. Both components must use paired elements with `data-zh lang="zh-CN"` and `data-en lang="en"` for interface copy.

- [ ] **Step 5: Implement the base layout and design tokens**

`BaseLayout.astro` must:

- accept `title`, `description`, and optional `contentLanguage`;
- set canonical URL using `new URL(Astro.url.pathname, Astro.site)`;
- output description, theme color, canonical link, and a data-URL favicon;
- include a skip link, `SiteHeader`, slotted `<main id="main-content">`, and `SiteFooter`;
- import `tokens.css`, `global.css`, and `layout.css`;
- call `initializeLanguage()` from a processed Astro `<script>`;
- keep the article content `lang` independent from the interface toggle.

Start `tokens.css` with the approved palette and measurements:

```css
:root {
  color-scheme: dark;
  --space-950: #05070d;
  --space-900: #090d16;
  --space-800: #111827;
  --star: #f4f7fb;
  --muted: #9aa9bc;
  --cyan: #71ddff;
  --cyan-soft: rgba(113, 221, 255, 0.16);
  --amber: #f4b66a;
  --line: rgba(148, 179, 205, 0.22);
  --panel: rgba(8, 14, 24, 0.78);
  --shell: min(1180px, calc(100vw - 40px));
  --radius: 18px;
  --font-sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
}
```

`global.css` must define box sizing, dark body background, readable line height, link and focus styles, `[data-lang='zh'] [data-en]` / `[data-lang='en'] [data-zh]` visibility, skip-link behavior, and `prefers-reduced-motion` transition removal. `layout.css` must define `.shell`, sticky header, navigation, main spacing, and responsive breakpoints at 900px and 640px.

- [ ] **Step 6: Replace the temporary page with BaseLayout**

Update `src/pages/index.astro` to render `BaseLayout` and a temporary semantic heading. Do not add final homepage sections yet.

- [ ] **Step 7: Run unit, type, and build checks**

Delete `tests/site-language-test.mjs` after confirming `tests/language.test.ts` covers stored preference, browser fallback, and toggling without depending on the superseded root `js/site.js` module.

Run: `npm run test:unit && npm run check && npm run build`

Expected: language tests PASS; generated HTML contains the skip link, bilingual navigation, canonical URL, language toggle, and no external font or script URL.

- [ ] **Step 8: Commit the bilingual shell**

```bash
git add src/data/site.ts src/layouts/BaseLayout.astro src/components/SiteHeader.astro src/components/SiteFooter.astro src/scripts/language.ts src/styles/tokens.css src/styles/global.css src/styles/layout.css src/pages/index.astro tests/language.test.ts tests/site-language-test.mjs
git commit -m "feat(ui): 构建中英双语站点框架"
```

---

### Task 4: Implement the Orbital Archive Homepage

**Files:**
- Create: `src/components/Hero.astro`
- Create: `src/components/ResearchOrbit.astro`
- Create: `src/components/ProjectMissions.astro`
- Create: `src/components/LatestTransmissions.astro`
- Create: `src/components/ProfileSection.astro`
- Create: `src/components/PostCard.astro`
- Create: `src/components/PostMeta.astro`
- Create: `src/components/TagList.astro`
- Create: `src/styles/components.css`
- Modify: `src/pages/index.astro`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `tests/site-static-test.mjs`

**Interfaces:**
- Consumes: `site.projects`, `getCollection('blog')`, `selectHomepagePosts(posts, 3)`, and `PostRecord`.
- Produces: homepage section IDs `launch`, `research`, `projects`, `transmissions`, and `about`; reusable `PostCard` props `{ post, headingLevel?: 'h2' | 'h3' }`.

- [ ] **Step 1: Rewrite the static test to describe the generated homepage**

Replace homepage assertions in `tests/site-static-test.mjs` so the test reads `dist/index.html` and requires:

```js
assert.match(home, /UnlearnedMan/);
assert.match(home, /Shanghai Jiao Tong University/);
assert.match(home, /fly0307@sjtu\.edu\.cn/);
assert.match(home, /https:\/\/github\.com\/Fly0307\/MobiAgent/);
assert.match(home, /https:\/\/penglai-enclave\.systems\//);
assert.match(home, /id="research"/);
assert.match(home, /id="projects"/);
assert.match(home, /id="transmissions"/);
assert.match(home, /id="about"/);
assert.match(home, /data-empty-posts/);
assert.doesNotMatch(home, /Dominic|Dunky-Z\/comment|Gitalk/i);
```

- [ ] **Step 2: Build and verify the new homepage contract fails**

Run: `npm run build && node --test tests/site-static-test.mjs`

Expected: FAIL because the temporary page lacks the approved sections and confirmed links.

- [ ] **Step 3: Implement reusable post metadata primitives**

`PostMeta.astro` must accept `{ publishedAt: Date; updatedAt?: Date; language: 'zh' | 'en'; readingMinutes: number }`, output a semantic `<time>`, and show `中文` or `English` without translating the post.

`TagList.astro` must accept `{ tags: string[] }`, output no wrapper when the list is empty, and otherwise render normalized filter keys in `data-tag-key` while preserving author-facing tag text.

`PostCard.astro` must accept `{ post: PostRecord; headingLevel?: 'h2' | 'h3' }`, link to `/blog/${post.id}/`, apply `lang="zh-CN"` or `lang="en"` to the article card, and combine `PostMeta`, `TagList`, and `estimateReadingMinutes(post.body)`.

- [ ] **Step 4: Implement the five homepage content sections**

Implement components with the following exact content boundaries:

- `Hero.astro`: UnlearnedMan, SJTU undergraduate/master’s statement, confirmed high-level interests in intelligent agents, trusted execution environments, and systems research; `/img/hero-space.png`; links to `#projects` and `/blog/`.
- `ResearchOrbit.astro`: three bilingual nodes matching those same high-level interests; no dates, job title, publications, or contribution claims.
- `ProjectMissions.astro`: map exactly the two entries from `site.projects`; external links use `rel="noreferrer"`.
- `LatestTransmissions.astro`: accept `{ posts: PostRecord[] }`; render at most three `PostCard`s or a bilingual `data-empty-posts` message that says no transmissions are published yet.
- `ProfileSection.astro`: one `#about` section containing the confirmed SJTU education, GitHub link, and email link; no inferred department or dates.

All sections need an eyebrow mission number, one bilingual heading, semantic landmarks, and `data-reveal` hooks that do not hide content before JavaScript runs.

- [ ] **Step 5: Compose the homepage from collection data**

Update `src/pages/index.astro`:

```astro
---
import { getCollection } from 'astro:content';
import Hero from '../components/Hero.astro';
import LatestTransmissions from '../components/LatestTransmissions.astro';
import ProfileSection from '../components/ProfileSection.astro';
import ProjectMissions from '../components/ProjectMissions.astro';
import ResearchOrbit from '../components/ResearchOrbit.astro';
import BaseLayout from '../layouts/BaseLayout.astro';
import { selectHomepagePosts } from '../lib/posts';

const posts = selectHomepagePosts(await getCollection('blog'), 3);
---
<BaseLayout description="UnlearnedMan 的个人主页 / Personal homepage of UnlearnedMan">
  <Hero />
  <ResearchOrbit />
  <ProjectMissions />
  <LatestTransmissions posts={posts} />
  <ProfileSection />
</BaseLayout>
```

- [ ] **Step 6: Implement the responsive Orbital Archive component styles**

Create `components.css` with:

- a minimum-height hero using a readable text column and a masked 16:9 image;
- orbit-node borders drawn with pseudo-elements and cyan/amber state dots;
- two-column project cards above 760px and one column below it;
- `:hover` and `:focus-within` states with the same information;
- a three-column transmission grid above 900px and one column below 640px;
- typographic empty-state panel rather than a placeholder image;
- `overflow-wrap: anywhere` for email and long URLs;
- no backdrop blur stronger than `12px` and no text opacity below readable contrast.

Import `components.css` once from `BaseLayout.astro`.

- [ ] **Step 7: Verify the homepage and responsive source contract**

Run: `npm run check && npm run build && node --test tests/site-static-test.mjs`

Expected: PASS; `dist/index.html` contains all five sections, two confirmed projects, the empty-post state, bilingual interface copy, and no old-author runtime content.

- [ ] **Step 8: Commit the homepage**

```bash
git add src/components src/pages/index.astro src/layouts/BaseLayout.astro src/styles/components.css tests/site-static-test.mjs
git commit -m "feat(ui): 构建轨道档案主页内容"
```

---

### Task 5: Add Blog Archive, Filtering, Post Routes, RSS, and Sitemap

**Files:**
- Create: `src/layouts/PostLayout.astro`
- Create: `src/pages/blog/index.astro`
- Create: `src/pages/blog/[...slug].astro`
- Create: `src/pages/rss.xml.ts`
- Create: `src/scripts/blog-filter.ts`
- Create: `src/styles/blog.css`
- Create: `tests/blog-filter.test.ts`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `tests/site-static-test.mjs`
- Create: `public/robots.txt`

**Interfaces:**
- Consumes: `getPublishedPosts`, `normalizeTag`, `estimateReadingMinutes`, `PostCard`, `PostMeta`, and `TagList`.
- Produces: `/blog/`, `/blog/<id>/`, `/rss.xml`, `/sitemap-index.xml`; `BlogFilter` type and `matchesBlogFilter(card, filter)` pure function; query keys `language`, `tag`, and `year`.

- [ ] **Step 1: Write failing filter and generated-route tests**

Create `tests/blog-filter.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesBlogFilter, type BlogCardData } from '../src/scripts/blog-filter.ts';

const card: BlogCardData = { language: 'zh', tags: ['security', 'risc-v'], year: '2026' };

test('empty filters include every post', () => {
  assert.equal(matchesBlogFilter(card, {}), true);
});

test('language, tag, and year filters combine with AND semantics', () => {
  assert.equal(matchesBlogFilter(card, { language: 'zh', tag: 'security', year: '2026' }), true);
  assert.equal(matchesBlogFilter(card, { language: 'en' }), false);
  assert.equal(matchesBlogFilter(card, { tag: 'agents' }), false);
});
```

Extend `tests/site-static-test.mjs`:

```js
const blog = await readFile(new URL('dist/blog/index.html', root), 'utf8');
const rss = await readFile(new URL('dist/rss.xml', root), 'utf8');
const sitemap = await readFile(new URL('dist/sitemap-index.xml', root), 'utf8');

assert.match(blog, /data-blog-archive/);
assert.match(blog, /data-empty-posts/);
assert.match(blog, /name="language"/);
assert.match(blog, /name="tag"/);
assert.match(blog, /name="year"/);
assert.match(rss, /<rss[\s>]/);
assert.match(sitemap, /<sitemapindex[\s>]/);
```

- [ ] **Step 2: Run the focused tests and verify missing blog modules fail**

Run: `npx tsx --test --test-name-pattern="filters" tests/blog-filter.test.ts && npm run build && node --test tests/site-static-test.mjs`

Expected: FAIL because `blog-filter.ts` and blog routes do not exist.

- [ ] **Step 3: Implement pure filter matching and progressive enhancement**

Create `src/scripts/blog-filter.ts`:

```ts
export interface BlogCardData {
  language: 'zh' | 'en';
  tags: string[];
  year: string;
}

export interface BlogFilter {
  language?: string;
  tag?: string;
  year?: string;
}

export function matchesBlogFilter(card: BlogCardData, filter: BlogFilter): boolean {
  return (!filter.language || card.language === filter.language)
    && (!filter.tag || card.tags.includes(filter.tag))
    && (!filter.year || card.year === filter.year);
}

export function initializeBlogFilter(): void {
  const form = document.querySelector<HTMLFormElement>('[data-blog-filter]');
  if (!form) return;
  const cards = [...document.querySelectorAll<HTMLElement>('[data-blog-card]')];
  const empty = document.querySelector<HTMLElement>('[data-filter-empty]');
  const apply = () => {
    const values = Object.fromEntries(new FormData(form)) as BlogFilter;
    let visible = 0;
    cards.forEach((element) => {
      const card = {
        language: element.dataset.language as 'zh' | 'en',
        tags: JSON.parse(element.dataset.tags ?? '[]') as string[],
        year: element.dataset.year ?? '',
      };
      element.hidden = !matchesBlogFilter(card, values);
      if (!element.hidden) visible += 1;
    });
    if (empty) empty.hidden = visible !== 0;
    history.replaceState(null, '', `${location.pathname}${values.language || values.tag || values.year ? `?${new URLSearchParams(Object.entries(values).filter(([, value]) => value) as string[][])}` : ''}`);
  };
  new URLSearchParams(location.search).forEach((value, key) => {
    const control = form.elements.namedItem(key);
    if (control instanceof HTMLSelectElement) control.value = value;
  });
  form.addEventListener('change', apply);
  apply();
}
```

- [ ] **Step 4: Implement archive and article pages**

`src/pages/blog/index.astro` must:

- query `getCollection('blog')` and pass it through `getPublishedPosts`;
- derive unique languages, normalized tags, and years at build time;
- always output the complete article list for no-JavaScript access;
- render three labeled `<select>` controls named `language`, `tag`, and `year`;
- attach `data-language`, JSON `data-tags`, and `data-year` to each card wrapper;
- show the initial no-post empty state and a separate filtered-empty state;
- import and initialize `blog-filter.ts` in a processed `<script>`.

`src/pages/blog/[...slug].astro` must use the verified Astro 6 collection API:

```astro
---
import { getCollection, render } from 'astro:content';
import PostLayout from '../../layouts/PostLayout.astro';
import { getPublishedPosts } from '../../lib/posts';

export async function getStaticPaths() {
  const posts = getPublishedPosts(await getCollection('blog'));
  return posts.map((post, index) => ({
    params: { slug: post.id },
    props: {
      post,
      previous: posts[index + 1] ?? null,
      next: posts[index - 1] ?? null,
    },
  }));
}

const { post, previous, next } = Astro.props;
const { Content, headings } = await render(post);
---
<PostLayout post={post} headings={headings} previous={previous} next={next}>
  <Content />
</PostLayout>
```

`PostLayout.astro` must set the article `lang`, render title/description/meta/tags, generate an in-page TOC from depth-2 and depth-3 headings, wrap Markdown in `.prose`, and render adjacent links only when non-null.

- [ ] **Step 5: Implement RSS, sitemap discovery, and blog styles**

Create `src/pages/rss.xml.ts`:

```ts
import type { APIRoute } from 'astro';
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { getPublishedPosts } from '../lib/posts';

export const GET: APIRoute = async (context) => {
  const posts = getPublishedPosts(await getCollection('blog'));
  return rss({
    title: 'UnlearnedMan · Transmissions',
    description: 'Research notes and technical transmissions from UnlearnedMan.',
    site: context.site!,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.publishedAt,
      link: `/blog/${post.id}/`,
      customData: `<language>${post.data.language}</language>`,
    })),
  });
};
```

Create `public/robots.txt`:

```text
User-agent: *
Allow: /
Sitemap: https://fly0307.github.io/sitemap-index.xml
```

Create `blog.css` for the archive controls, cards, article header, sticky desktop TOC, `.prose` typography, tables, blockquotes, inline code, and horizontally scrollable fenced code. At widths below 900px, the TOC becomes a normal block above the article. Import it once from `BaseLayout.astro`.

- [ ] **Step 6: Verify empty blog, filter helpers, feed, and sitemap**

Run: `npm run test:unit && npm run check && npm run build && node --test tests/site-static-test.mjs`

Expected: PASS; `/blog/`, `/rss.xml`, and `/sitemap-index.xml` build with no published posts; no `/blog/_template/` route exists; unit filters use AND semantics.

- [ ] **Step 7: Commit the blog system**

```bash
git add src/layouts/PostLayout.astro src/pages/blog src/pages/rss.xml.ts src/scripts/blog-filter.ts src/styles/blog.css src/layouts/BaseLayout.astro tests/blog-filter.test.ts tests/site-static-test.mjs public/robots.txt
git commit -m "feat(blog): 增加文章归档与静态发布流程"
```

---

### Task 6: Add the Progressive Orbital Motion System

**Files:**
- Create: `src/scripts/motion-policy.ts`
- Create: `src/scripts/starfield.ts`
- Create: `src/scripts/section-reveal.ts`
- Create: `src/scripts/orbital-progress.ts`
- Create: `src/scripts/hero-parallax.ts`
- Create: `src/components/Starfield.astro`
- Create: `src/components/OrbitalProgress.astro`
- Create: `src/styles/motion.css`
- Create: `tests/motion-policy.test.ts`
- Modify: `src/pages/index.astro`
- Modify: `src/components/Hero.astro`
- Modify: `src/layouts/BaseLayout.astro`

**Interfaces:**
- Consumes: DOM hooks `data-starfield`, `data-reveal`, `data-orbit-section`, `data-orbit-progress`, and `data-hero-parallax`.
- Produces: `shouldAnimate({ reducedMotion, documentVisible, inViewport })`, `clampProgress(value)`, `createStars(count, width, height, random)`, and independent `initialize*()` browser entry points.

- [ ] **Step 1: Write failing motion-policy tests**

Create `tests/motion-policy.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { clampProgress, createStars, shouldAnimate } from '../src/scripts/motion-policy.ts';

test('continuous motion runs only when every policy condition allows it', () => {
  assert.equal(shouldAnimate({ reducedMotion: false, documentVisible: true, inViewport: true }), true);
  assert.equal(shouldAnimate({ reducedMotion: true, documentVisible: true, inViewport: true }), false);
  assert.equal(shouldAnimate({ reducedMotion: false, documentVisible: false, inViewport: true }), false);
  assert.equal(shouldAnimate({ reducedMotion: false, documentVisible: true, inViewport: false }), false);
});

test('scroll progress is clamped to the visible range', () => {
  assert.equal(clampProgress(-0.5), 0);
  assert.equal(clampProgress(0.42), 0.42);
  assert.equal(clampProgress(1.5), 1);
});

test('generated stars stay inside the canvas', () => {
  const stars = createStars(2, 100, 50, () => 0.5);
  assert.deepEqual(stars, [
    { x: 50, y: 25, radius: 1.25, alpha: 0.65 },
    { x: 50, y: 25, radius: 1.25, alpha: 0.65 },
  ]);
});
```

- [ ] **Step 2: Run the motion tests and verify the policy module is missing**

Run: `npx tsx --test --test-name-pattern="continuous motion|scroll progress|generated stars" tests/motion-policy.test.ts`

Expected: FAIL because `motion-policy.ts` does not exist.

- [ ] **Step 3: Implement deterministic motion policy helpers**

Create `src/scripts/motion-policy.ts`:

```ts
export interface MotionState {
  reducedMotion: boolean;
  documentVisible: boolean;
  inViewport: boolean;
}

export interface Star {
  x: number;
  y: number;
  radius: number;
  alpha: number;
}

export const shouldAnimate = (state: MotionState) =>
  !state.reducedMotion && state.documentVisible && state.inViewport;

export const clampProgress = (value: number) => Math.min(1, Math.max(0, value));

export function createStars(
  count: number,
  width: number,
  height: number,
  random: () => number = Math.random,
): Star[] {
  return Array.from({ length: count }, () => ({
    x: random() * width,
    y: random() * height,
    radius: 0.5 + random() * 1.5,
    alpha: 0.3 + random() * 0.7,
  }));
}
```

- [ ] **Step 4: Implement independent browser motion modules**

Implement these lifecycle rules exactly:

- `starfield.ts`: locate one canvas, size for device pixel ratio capped at 2, create 70 desktop or 32 mobile stars, observe canvas intersection, listen for visibility and reduced-motion changes, run one `requestAnimationFrame` loop only while `shouldAnimate` is true, and cancel the frame on stop.
- `section-reveal.ts`: add a `motion-ready` class only after observer setup, mark each `data-reveal` element `is-visible` once at a `0.15` threshold, then unobserve it. Under reduced motion, mark all visible immediately.
- `orbital-progress.ts`: derive progress from `scrollY / (scrollHeight - innerHeight)`, write `--page-progress`, and set `aria-current="step"` on the nearest `data-orbit-section` link. Throttle reads through one animation frame.
- `hero-parallax.ts`: write `--hero-shift` and `--hero-scale` only while the hero intersects and motion is allowed; cap translation at 64px and scale at 1.06.

Each module exports one `initializeStarfield`, `initializeSectionReveal`, `initializeOrbitalProgress`, or `initializeHeroParallax` function and returns without error when its hook is absent.

- [ ] **Step 5: Add decorative components and approved motion CSS**

`Starfield.astro` outputs one `aria-hidden="true"` canvas with a static CSS star-gradient fallback. `OrbitalProgress.astro` outputs five links matching homepage sections and a progress track; it is keyboard-inert decoration except for the actual anchor links.

`motion.css` must:

- keep `[data-reveal]` visible by default;
- apply opacity/translation only under `.motion-ready [data-reveal]`;
- animate `.is-visible` once with durations below 700ms;
- drive track fill from `--page-progress`;
- drive hero transform from `--hero-shift` and `--hero-scale`;
- disable all transforms, transitions, and animated canvas display under `prefers-reduced-motion: reduce`;
- use a top progress line below 760px instead of a fixed side rail.

- [ ] **Step 6: Initialize motion only on the homepage**

Add `Starfield` and `OrbitalProgress` to `src/pages/index.astro`. Add `data-hero-parallax` to the hero visual and `data-orbit-section` to the five section roots. Import the four initialization functions in one processed homepage `<script>` and call each once. Do not load starfield or parallax code from `PostLayout.astro`.

- [ ] **Step 7: Verify policy, build, and reduced-motion source contract**

Run: `npm run test:unit && npm run check && npm run build`

Then run:

```bash
rg -n "prefers-reduced-motion|cancelAnimationFrame|visibilitychange|IntersectionObserver|data-orbit-progress" src
```

Expected: all tests PASS; every required lifecycle mechanism appears in focused modules; article pages do not import `starfield.ts` or `hero-parallax.ts`.

- [ ] **Step 8: Commit the motion system**

```bash
git add src/scripts/motion-policy.ts src/scripts/starfield.ts src/scripts/section-reveal.ts src/scripts/orbital-progress.ts src/scripts/hero-parallax.ts src/components/Starfield.astro src/components/OrbitalProgress.astro src/styles/motion.css src/pages/index.astro src/components/Hero.astro src/layouts/BaseLayout.astro tests/motion-policy.test.ts
git commit -m "feat(ui): 增加轨道滚动与星空动效"
```

---

### Task 7: Complete 404 Migration and Old-Site Runtime Cleanup

**Files:**
- Create: `src/pages/404.astro`
- Modify: `tests/site-static-test.mjs`
- Delete: `index.html`
- Delete: `404.html`
- Delete: `css/site.css`
- Delete: `js/site.js`
- Delete: `.nojekyll` if present
- Delete: empty `css/`, `js/`, and `img/` directories after tracked files move

**Interfaces:**
- Consumes: `BaseLayout`, confirmed runtime identity, Astro-generated `dist/`.
- Produces: `/404.html`; a regression scan limited to runtime source and generated output, excluding historical docs and Git history.

- [ ] **Step 1: Add failing 404 and forbidden-runtime assertions**

Extend `tests/site-static-test.mjs`:

```js
const notFound = await readFile(new URL('dist/404.html', root), 'utf8');
assert.match(notFound, /404/);
assert.match(notFound, /href="\/"/);
assert.match(notFound, /href="\/blog\/"/);

const runtimeText = [home, blog, notFound, rss, sitemap].join('\n');
for (const forbidden of [
  /Dominic/i,
  /Dunky-Z\/comment/i,
  /gitalk/i,
  /leancloud/i,
  /fluid/i,
]) {
  assert.doesNotMatch(runtimeText, forbidden);
}
```

Add filesystem assertions that root `index.html`, root `404.html`, `css/site.css`, and `js/site.js` no longer exist after migration.

- [ ] **Step 2: Build and verify the missing Astro 404/cleanup fails**

Run: `npm run build && node --test tests/site-static-test.mjs`

Expected: FAIL because the Astro 404 page is absent and transitional root files still exist.

- [ ] **Step 3: Implement the bilingual Astro 404 page**

Create `src/pages/404.astro` using `BaseLayout`. It must include:

- mission code `404 / SIGNAL LOST`;
- Chinese copy explaining that the requested coordinate is unavailable;
- English copy explaining that the requested coordinate is unavailable;
- links to `/` and `/blog/`;
- no automatic redirect and no decorative continuous animation.

- [ ] **Step 4: Remove only the superseded root runtime files**

Delete the listed root HTML, CSS, JavaScript, and `.nojekyll` files after confirming their replacements build. Remove empty transitional directories, but preserve `docs/`, `tests/`, `public/`, and all Git history.

- [ ] **Step 5: Run the complete source and output regression suite**

Run: `npm test`

Expected: PASS; generated pages contain only confirmed identity and project links; runtime source/output contains none of the forbidden old-site markers; the Markdown template remains unpublished.

- [ ] **Step 6: Commit the completed runtime migration**

```bash
git add -A index.html 404.html css js img .nojekyll src/pages/404.astro tests/site-static-test.mjs
git commit -m "refactor(site): 完成 Astro 页面迁移与旧入口清理"
```

---

### Task 8: Add GitHub Pages Deployment and Maintainer Documentation

**Files:**
- Create: `.github/workflows/deploy.yml`
- Create: `tests/deployment-contract-test.mjs`
- Modify: `README.md`

**Interfaces:**
- Consumes: npm scripts and `dist/` from Tasks 1–7.
- Produces: GitHub Pages artifact deployment on `main` pushes or manual dispatch; documented local development, article publishing, and repository Pages settings.

- [ ] **Step 1: Write the failing deployment contract test**

Create `tests/deployment-contract-test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflow = await readFile(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');

test('Pages workflow builds and deploys only the dist artifact', () => {
  assert.match(workflow, /push:[\s\S]*branches:\s*\[main\]/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /contents:\s*read/);
  assert.match(workflow, /pages:\s*write/);
  assert.match(workflow, /id-token:\s*write/);
  assert.match(workflow, /actions\/configure-pages@v5/);
  assert.match(workflow, /actions\/upload-pages-artifact@v4/);
  assert.match(workflow, /path:\s*['"]?dist\/?.*$/m);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /needs:\s*build/);
});
```

- [ ] **Step 2: Run the deployment test and verify the workflow is missing**

Run: `node --test tests/deployment-contract-test.mjs`

Expected: FAIL with `ENOENT` for `.github/workflows/deploy.yml`.

- [ ] **Step 3: Implement the official GitHub Pages workflow**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy Astro site to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v5
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - name: Install dependencies
        run: npm ci
      - name: Check Astro and content
        run: npm run check
      - name: Run unit tests
        run: npm run test:unit
      - name: Build static site
        run: npm run build
      - name: Run generated-site tests
        run: npm run test:static
      - name: Configure Pages
        uses: actions/configure-pages@v5
      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v4
        with:
          path: dist/

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 4: Rewrite README as the maintainer runbook**

Document these exact workflows in `README.md`:

```text
npm install       # first local setup
npm run dev       # local preview
npm test          # check, build, unit tests, generated-site tests
```

Include:

- content location `src/content/blog/` and instruction to copy `_template.md` to a filename not beginning with `_`;
- accepted language values `zh` and `en`, with one language per article;
- draft and featured behavior;
- local preview and production build commands;
- GitHub Pages repository setting: Settings → Pages → Source → GitHub Actions;
- deployment trigger: push to `main` or manual workflow dispatch;
- canonical site `https://fly0307.github.io/`;
- statement that `dist/` is generated and not committed;
- statement that old-author content and old Gitalk configuration must never be reintroduced.

- [ ] **Step 5: Run clean-install and full release verification**

Run in the existing workspace:

```bash
npm ci
npm test
git diff --check
```

Expected: dependency install is reproducible; Astro check, content tests, language/filter/motion tests, production build, static regression, RSS, sitemap, 404, and workflow contract all PASS; Git diff contains no whitespace errors.

- [ ] **Step 6: Perform browser acceptance against the production build**

Run: `npm run build && npx astro preview --host 127.0.0.1`

Verify at desktop 1440×900 and mobile 390×844:

- homepage hierarchy, hero image crop, five sections, projects, empty transmissions, and bilingual copy;
- interface language persistence after reload;
- `/blog/` filters and empty state;
- `/404.html` recovery links;
- keyboard focus order and visible focus rings;
- no horizontal overflow;
- normal motion, reduced-motion, and JavaScript-disabled degradation;
- browser console has no errors and all local resources return success.

Expected: every browser acceptance item passes. Fix any discovered defect in the owning focused module and rerun its automated checks before continuing.

- [ ] **Step 7: Commit deployment and documentation**

```bash
git add .github/workflows/deploy.yml tests/deployment-contract-test.mjs README.md
git commit -m "ci(pages): 增加 Astro 自动构建与部署"
```

---

## Final Verification Checklist

Run after all task commits and before claiming completion:

```bash
npm ci
npm test
git diff --check
git status --short --branch
```

Confirm:

- [ ] `dist/index.html`, `dist/blog/index.html`, `dist/404.html`, `dist/rss.xml`, and `dist/sitemap-index.xml` exist.
- [ ] No public post route is generated from `_template.md`.
- [ ] Runtime source and built output contain no Dominic, Fluid, Gitalk, `Dunky-Z/comment`, old homepage, OAuth, analytics, or tracking content.
- [ ] Only the confirmed email, GitHub account, education statement, MobiAgent link, and Penglai official link are present.
- [ ] The UI switches languages without changing or hiding article source language.
- [ ] Homepage continuous motion stops under reduced-motion, hidden-document, and off-screen conditions.
- [ ] Blog and article content remain readable without JavaScript.
- [ ] GitHub Pages workflow uploads only `dist/` and deploys only after the build job succeeds.
- [ ] `.superpowers/`, `dist/`, `node_modules/`, and `.astro/` remain untracked.
- [ ] The branch is not pushed until the user explicitly authorizes it.
