# UnlearnedMan Personal Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy blog article archive with a lightweight, bilingual, accessible personal homepage for UnlearnedMan.

**Architecture:** Serve a self-contained static site directly from the repository root. `index.html` provides semantic bilingual content, `css/site.css` owns responsive visual presentation, and `js/site.js` owns the persisted language preference. A Node built-in assertion script validates the published file set and prevents legacy identity, analytics, comment configuration, and article directories from returning.

**Tech Stack:** HTML5, CSS3, vanilla ES modules, Node.js built-in `assert`/`fs`/`path`, GitHub Pages branch publishing.

**Spec:** `docs/superpowers/specs/2026-08-28-personal-homepage-redesign-design.md`

## Global Constraints

- Do not add `package.json`, static blog generators, Jekyll, custom GitHub Actions, external fonts, external icon libraries, third-party analytics, comments, forms, or CDN dependencies.
- Public profile data is limited to UnlearnedMan, SJTU undergraduate and master's education, `fly0307@sjtu.edu.cn`, GitHub, MobiAgent, and Penglai links approved in the spec.
- Treat the user-supplied 16:9 image as the primary wide hero visual; do not crop it into a small circular avatar.
- Delete all legacy article, archive, category, tag, pagination, old-about, search, Fluid-theme, comment-integration, analytics, and Jekyll-starter content from the current version.
- Do not rewrite Git history or change GitHub Pages settings; `main` root remains the publication source.

---

### Task 1: Establish a static-site regression check

**Files:**
- Create: `tests/site-static-test.mjs`
- Create: `.nojekyll`

**Interfaces:**
- Consumes: repository root paths and the current expected public profile values.
- Produces: `node tests/site-static-test.mjs`, which exits 0 only when the required static files, approved links, bilingual markers, accessibility markers, and no-legacy-content rules are satisfied.

- [ ] **Step 1: Write the failing test**

Create `tests/site-static-test.mjs` using only Node built-ins. Define helpers that read UTF-8 files and throw with the file name and missing or forbidden text. Require `index.html`, `404.html`, `css/site.css`, `js/site.js`, `img/hero-space.png`, and `.nojekyll`; require the approved contact and project URLs, `lang=\"zh-CN\"`, `lang=\"en\"`, a `<main` element, a skip link, `prefers-reduced-motion`, and `localStorage`. Reject all retired identity, comment, credential, statistics, and generator identifiers across every published text file, including docs and tests; construct each forbidden identifier from safe fragments at runtime so the regression source does not republish it. Also reject the legacy directories `2020`, `2021`, `2022`, `archives`, `categories`, `tags`, `page`, `links`, and `about`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/site-static-test.mjs`

Expected: failure stating that `css/site.css`, `js/site.js`, `img/hero-space.png`, or `.nojekyll` is missing and that legacy paths still exist.

- [ ] **Step 3: Add the static publishing marker**

Create an empty `.nojekyll` file at the repository root. This makes GitHub Pages serve the new static files without Jekyll transformation.

- [ ] **Step 4: Re-run the test to keep the expected failing baseline**

Run: `node tests/site-static-test.mjs`

Expected: still fails because the new homepage implementation and legacy cleanup have not happened yet.

### Task 2: Build the bilingual homepage and interaction layer

**Files:**
- Create: `index.html`
- Create: `css/site.css`
- Create: `js/site.js`
- Create: `404.html`
- Create: `img/hero-space.png`
- Modify: `README.md`
- Test: `tests/site-static-test.mjs`

**Interfaces:**
- Consumes: `data-lang` values `zh` and `en` on `<html>`, the `#language-toggle` button, `[data-zh]` and `[data-en]` content elements, the hero image at `/img/hero-space.png`, and the public URLs in the specification.
- Produces: a no-build, responsive homepage and 404 page with persisted language switching.

- [ ] **Step 1: Extend the failing test for the public page contract**

Add assertions requiring `id=\"language-toggle\"`, `data-zh`, `data-en`, `aria-live=\"polite\"`, `href=\"https://github.com/Fly0307/MobiAgent\"`, `href=\"https://penglai-enclave.systems/\"`, and `href=\"mailto:fly0307@sjtu.edu.cn\"` in `index.html`. Require `export function resolveLanguage` and `export function setLanguage` in `js/site.js`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/site-static-test.mjs`

Expected: failure because the homepage contract has not yet been implemented.

- [ ] **Step 3: Implement the homepage document**

Replace `index.html` with a semantic document containing a skip link; a navigation bar; a hero with the supplied space image, nickname, bilingual intro, and action links; project cards for MobiAgent and Penglai; an SJTU education section; a contact section; and a bilingual footer. Place all bilingual copy in paired `data-zh` and `data-en` elements. Use only the approved facts and links. Add a descriptive image `alt` text in both languages.

- [ ] **Step 4: Implement presentation and responsive behavior**

Create `css/site.css` with dark engineering-themed colors, a two-column desktop hero that collapses at `760px`, high-contrast focus indicators, `prefers-reduced-motion` handling, language visibility controlled by `html[data-lang=\"zh\"]` and `html[data-lang=\"en\"]`, and no fixed width that can overflow on a 320px viewport.

- [ ] **Step 5: Implement language preference behavior**

Create `js/site.js` as a browser-safe ES module. Export `resolveLanguage(storedLanguage, browserLanguage)` and `setLanguage(language)`. `resolveLanguage` must return `zh` only for stored `zh` or browser languages starting with `zh`, otherwise `en`; `setLanguage` updates `document.documentElement.dataset.lang`, the toggle button labels and `aria-label`, then writes the selected language to `localStorage` under `unlearnedman-language`. Initialize this behavior only when `document` exists and bind the toggle click handler.

- [ ] **Step 6: Replace the 404 page and write maintenance instructions**

Create a matching minimal bilingual `404.html` with a return-home link. Rewrite `README.md` with the deployed URL, a one-command local preview using `python3 -m http.server`, the Node validation command, and the `main` branch GitHub Pages deployment note.

- [ ] **Step 7: Add the supplied image**

Copy the exact user-supplied image to `img/hero-space.png` without resizing or modifying it. It must be the only retained image asset.

- [ ] **Step 8: Run the static regression check**

Run: `node tests/site-static-test.mjs`

Expected: still fails only on legacy paths or files, proving the new implementation exists before destructive cleanup.

### Task 3: Remove the legacy site and validate publishing output

**Files:**
- Delete: `2020/`, `2021/`, `2022/`, `about/`, `archives/`, `categories/`, `css/main.css`, the legacy comment stylesheet, `img/avatar.png`, `img/default.png`, `img/favicon.png`, `img/loading.gif`, `img/bg/`, `js/`, `lib/`, `links/`, `page/`, `tags/`, `local-search.xml`, `xml/`, `_config.yml`, `index.md`
- Modify: `tests/site-static-test.mjs`
- Test: `tests/site-static-test.mjs`

**Interfaces:**
- Consumes: the new homepage assets from Task 2 and the explicit deletion manifest above.
- Produces: a clean static site with no old articles, author data, tracking code, retired comment configuration, or obsolete navigation targets.

- [ ] **Step 1: Extend the failing test to validate the exact published file set**

Add a recursive file-list assertion that permits only `.git` files, `docs/`, `tests/`, `README.md`, `.nojekyll`, `index.html`, `404.html`, `css/site.css`, `js/site.js`, and `img/hero-space.png`. Exclude `.DS_Store` from the assertion if it exists. This prevents old static content from remaining after cleanup.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/site-static-test.mjs`

Expected: failure listing old directories and legacy site files.

- [ ] **Step 3: Delete the explicit legacy manifest**

Use `git rm -r` only for the exact paths listed in this task. Do not delete `docs/`, `tests/`, `.git`, `README.md`, or the new homepage files. Confirm `git status --short` lists only the planned removals and new static-site files.

- [ ] **Step 4: Run the static regression check**

Run: `node tests/site-static-test.mjs`

Expected: PASS with a concise success message.

- [ ] **Step 5: Verify local HTTP publishing behavior**

Run `python3 -m http.server 4173 --directory .` in a temporary background process, then request `/`, `/css/site.css`, `/js/site.js`, `/img/hero-space.png`, and `/404.html` with `curl -I`. Stop the server after verifying each path returns HTTP 200 with an appropriate content type.

- [ ] **Step 6: Verify repository safety and commit**

Run:

```bash
git diff --check
git status --short
git diff --cached --check
```

Stage exactly the new homepage, test, README, image, `.nojekyll`, and planned deletions. Commit with:

```bash
git commit -m "feat(site): 重构中英双语个人主页" -m "- 移除旧静态博客文章与第三方追踪配置\n- 新增 UnlearnedMan 双语简介、项目与联系方式\n- 保留 GitHub Pages 无构建发布方式"
```

Expected: clean working tree after the commit; no push is performed.

## Plan Self-Review

- Spec coverage: Tasks 1–3 cover static deployment, bilingual content, all approved profile data and links, supplied hero image, responsive/accessibility behavior, 404 handling, old-site removal, credential/analytics cleanup, README maintenance, and local validation.
- Placeholder scan: no incomplete tasks or unspecified implementation steps remain.
- Interface consistency: `data-lang`, `data-zh`, `data-en`, `#language-toggle`, `resolveLanguage`, `setLanguage`, and the local storage key are defined once and referenced consistently across tasks.
