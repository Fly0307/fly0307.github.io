import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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

test('continuous motion modules fall back safely without IntersectionObserver', async () => {
  const root = new URL('../', import.meta.url);
  const modules = await Promise.all([
    readFile(new URL('src/scripts/starfield.ts', root), 'utf8'),
    readFile(new URL('src/scripts/hero-parallax.ts', root), 'utf8'),
  ]);

  modules.forEach((source) => {
    assert.match(source, /if \(!\('IntersectionObserver' in window\)\) return;/);
  });
});
