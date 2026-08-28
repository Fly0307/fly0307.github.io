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
  assert.equal(normalizeTag('  Trusted Execution  '), 'trusted-execution');
  assert.equal(normalizeTag('C++'), 'c');
  assert.equal(normalizeTag('Agent / Systems'), 'agent-systems');
  assert.equal(estimateReadingMinutes('hello world'), 1);
  assert.equal(estimateReadingMinutes('研'.repeat(601)), 3);
});
