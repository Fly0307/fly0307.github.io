import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
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
    return entry.isDirectory() ? readTree(path) : readFile(path, 'utf8');
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

  assert.match(home, /UnlearnedMan/);
  assert.match(home, /Shanghai Jiao Tong University/);
  assert.match(home, /fly0307@sjtu\.edu\.cn/);
  assert.match(home, /https:\/\/github\.com\/IPADS-SAI\/MobiAgent/);
  assert.match(home, /https:\/\/penglai-enclave\.systems\//);
  assert.match(home, /id="launch"/);
  assert.match(home, /id="research"/);
  assert.match(home, /id="projects"/);
  assert.match(home, /id="transmissions"/);
  assert.match(home, /id="about"/);
  assert.match(home, /data-empty-posts/);
  assert.doesNotMatch(home, /Dominic|Dunky-Z\/comment|Gitalk/i);
});

test('generated blog surfaces only the static publishing contract', async () => {
  const blog = await readFile(new URL('dist/blog/index.html', root), 'utf8');
  const rss = await readFile(new URL('dist/rss.xml', root), 'utf8');
  const sitemap = await readFile(new URL('dist/sitemap-index.xml', root), 'utf8');
  const robots = await readFile(new URL('dist/robots.txt', root), 'utf8');
  const blogEntries = await readdir(new URL('dist/blog/', root));

  assert.match(blog, /data-blog-archive/);
  assert.match(blog, /data-empty-posts/);
  assert.match(blog, /name="language"/);
  assert.match(blog, /name="tag"/);
  assert.match(blog, /name="year"/);
  assert.match(rss, /<rss[\s>]/);
  assert.match(sitemap, /<sitemapindex[\s>]/);
  assert.match(robots, /Sitemap: https:\/\/fly0307\.github\.io\/sitemap-index\.xml/);
  assert.deepEqual(blogEntries.sort(), ['index.html']);
  assert.doesNotMatch(`${blog}\n${rss}\n${sitemap}`, /blog-template|文章标题 \/ Post title/);
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
