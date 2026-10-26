import assert from 'node:assert/strict';
import { readFile, readdir, stat, access } from 'node:fs/promises';
import test from 'node:test';
import { parse } from 'yaml';

const root = new URL('../dist/', import.meta.url);
const album = await readFile(new URL('memories/shanshan/index.html', root), 'utf8');
const source = await readFile(new URL('../src/content/blog/shanshan.md', import.meta.url), 'utf8');
const draft = parse(source.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1]).draft === true;
const post = draft ? source : await readFile(new URL('blog/shanshan/index.html', root), 'utf8');
const data = JSON.parse(album.match(/const ALBUM = ([\s\S]*?);<\/script>/)[1]);
const plain = value => value.replace(/<[^>]*>/g, '').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&#39;', "'");

test('published article and album preserve all photos, groups, and original paragraphs', async () => {
  assert.equal(data.chapters.length, 6);
  const stories = data.chapters.flatMap(chapter => chapter.stories);
  assert.equal(stories.length, 45);
  assert.equal(data.photos.length, 94);
  assert.equal(new Set(stories.flatMap(story => story.images)).size, 94);
  const files = await readdir(new URL('memories/shanshan/assets/', root));
  assert.equal(files.length, 94);
  assert.equal((post.match(/<img /g) ?? []).length, (source.match(/<img /g) ?? []).length);
  let paragraphs = 0;
  for (const story of stories) {
    for (const text of [...story.paragraphs, ...story.afterword]) {
      if (plain(source).includes(plain(text))) assert.ok(plain(post).includes(plain(text)), story.title);
      paragraphs++;
    }
    if (source.includes('/memories/shanshan/#' + story.id)) assert.ok(post.includes('/memories/shanshan/#' + story.id));
  }
  assert.equal(paragraphs, 53);
  for (const photo of data.photos) {
    if (source.includes('/memories/shanshan/' + photo.src)) assert.ok(post.includes('/memories/shanshan/' + photo.src));
    assert.ok((await stat(new URL('memories/shanshan/' + photo.src, root))).size > 0);
  }
});

test('public pages have reciprocal links and appear in discovery feeds', async () => {
  if (source.includes('href="/memories/shanshan/"')) assert.match(post, /href="\/memories\/shanshan\/"/);
  assert.match(album, /href="\/blog\/shanshan\/"/);
  assert.doesNotMatch(album, /app\.notion\.com|notion-file-block:|127\.0\.0\.1|file:\/\/|可以离线打开/);
  const rss = await readFile(new URL('rss.xml', root), 'utf8');
  const sitemap = await readFile(new URL('sitemap-0.xml', root), 'utf8');
  for (const feed of [rss, sitemap]) assert.equal(feed.includes('https://fly0307.github.io/blog/shanshan/'), !draft);
  if (draft) await assert.rejects(access(new URL('blog/shanshan/index.html', root)));
});
