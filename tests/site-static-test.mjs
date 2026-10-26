import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { parse } from 'yaml';

const root = new URL('../', import.meta.url);
const siteContent = JSON.parse(await readFile(new URL('src/data/site-content.json', root), 'utf8'));
const sourceEntries = await readdir(new URL('src/content/blog/', root), { recursive: true });
const publishedSlugs = [];
for (const entry of sourceEntries.filter(entry => entry.endsWith('.md'))) {
  const source = await readFile(new URL(`src/content/blog/${entry}`, root), 'utf8');
  const metadata = parse(source.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1]);
  if (metadata.draft !== true) publishedSlugs.push(entry.slice(0, -3));
}
const decodeHtml = text => text.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>');
const forbiddenRuntimeMarkers = [
  /Dominic/i,
  /Dunky-Z\/comment/i,
  /gitalk/i,
  /leancloud/i,
  /fluid/i,
];

async function readTree(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = await Promise.all(entries.map(async (entry) => {
    const path = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
    if (entry.isDirectory()) return readTree(path);
    return /\.(?:html|css|js|mjs|ts|astro|md|json|xml|txt)$/.test(entry.name) ? readFile(path, 'utf8') : '';
  }));

  return contents.flat(Infinity).join('\n');
}

async function pathExists(path) {
  try {
    await access(new URL(path, root));
    return true;
  } catch {
    return false;
  }
}

test('generated homepage presents the confirmed Orbital Archive profile', async () => {
  const home = await readFile(new URL('dist/index.html', root), 'utf8');

  const decoded = decodeHtml(home);
  for (const value of [siteContent.name, siteContent.email, siteContent.hero.zh, siteContent.hero.en, siteContent.about.zh, siteContent.about.en]) assert.ok(decoded.includes(value.trim()), value);
  for (const project of siteContent.projects) {
    assert.ok(decoded.includes(project.name.trim()));
    assert.ok(decoded.includes(`href="${project.url}"`));
  }
  assert.match(home, /id="launch"/);
  assert.match(home, /id="research"/);
  assert.match(home, /id="projects"/);
  assert.match(home, /id="transmissions"/);
  assert.match(home, /id="about"/);
  assert.equal(home.includes('data-empty-posts'), publishedSlugs.length === 0);
  assert.doesNotMatch(home, /Dominic|Dunky-Z\/comment|Gitalk/i);
});

test('generated blog surfaces only the static publishing contract', async () => {
  const blog = await readFile(new URL('dist/blog/index.html', root), 'utf8');
  const rss = await readFile(new URL('dist/rss.xml', root), 'utf8');
  const sitemap = await readFile(new URL('dist/sitemap-index.xml', root), 'utf8');
  const robots = await readFile(new URL('dist/robots.txt', root), 'utf8');
  const blogEntries = await readdir(new URL('dist/blog/', root));

  assert.match(blog, /data-blog-archive/);
  assert.equal(blog.includes('data-empty-posts'), publishedSlugs.length === 0);
  assert.match(blog, /name="language"/);
  assert.match(blog, /name="tag"/);
  assert.match(blog, /name="year"/);
  assert.match(rss, /<rss[\s>]/);
  assert.match(sitemap, /<sitemapindex[\s>]/);
  assert.match(robots, /Sitemap: https:\/\/fly0307\.github\.io\/sitemap-index\.xml/);
  assert.ok(!blogEntries.includes('blog-template'));
  for (const slug of publishedSlugs) {
    assert.ok(blog.includes(`/blog/${slug}/`));
    assert.ok(rss.includes(`/blog/${slug}/`));
  }
  assert.doesNotMatch(`${blog}\n${rss}\n${sitemap}`, /blog-template|文章标题 \/ Post title/);
});

test('admin entry is excluded from search indexing and includes the repository editor', async () => {
  const admin = await readFile(new URL('dist/admin/index.html', root), 'utf8');
  const sitemap = await readFile(new URL('dist/sitemap-0.xml', root), 'utf8');
  assert.match(admin, /noindex, nofollow/);
  for (const id of ['login-form', 'post-form', 'post-preview', 'image-file', 'settings-form', 'deployment-panel']) assert.ok(admin.includes(`id="${id}"`));
  assert.doesNotMatch(sitemap, /\/admin\//);
  assert.match(admin, /Content-Security-Policy/);
});

test('generated not-found page provides bilingual recovery links', async () => {
  const notFound = await readFile(new URL('dist/404.html', root), 'utf8');

  assert.match(notFound, /404\s*\/\s*SIGNAL LOST/);
  assert.match(notFound, /请求的坐标不可用/);
  assert.match(notFound, /requested coordinate is unavailable/i);
  assert.match(notFound, /href="\/"/);
  assert.match(notFound, /href="\/blog\/"/);
});

test('Astro runtime has replaced old site entry points and markers', async () => {
  for (const transitionalPath of ['index.html', '404.html', 'css/site.css', 'js/site.js', '.nojekyll']) {
    assert.equal(await pathExists(transitionalPath), false, `${transitionalPath} should be removed`);
  }

  const runtimeText = await Promise.all([
    readTree(new URL('src/', root)),
    readTree(new URL('public/', root)),
    readTree(new URL('dist/', root)),
  ]);

  for (const forbidden of forbiddenRuntimeMarkers) {
    assert.doesNotMatch(runtimeText.join('\n'), forbidden);
  }
});

test('post layout keeps an archive return link in the reading flow', async () => {
  const layout = await readFile(new URL('src/layouts/PostLayout.astro', root), 'utf8');

  assert.match(layout, /href="\/blog\/"/);
  assert.match(layout, /返回博客归档/);
  assert.match(layout, /Back to archive/);
});
