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
