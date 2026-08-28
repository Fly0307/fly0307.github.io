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
