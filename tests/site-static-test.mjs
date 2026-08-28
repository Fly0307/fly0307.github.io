import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('generated homepage presents the confirmed Orbital Archive profile', async () => {
  const home = await readFile(new URL('dist/index.html', root), 'utf8');

  assert.match(home, /UnlearnedMan/);
  assert.match(home, /Shanghai Jiao Tong University/);
  assert.match(home, /fly0307@sjtu\.edu\.cn/);
  assert.match(home, /https:\/\/github\.com\/Fly0307\/MobiAgent/);
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
