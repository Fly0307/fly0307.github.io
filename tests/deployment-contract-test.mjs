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
  assert.match(workflow, /group:\s*pages/);
  assert.match(workflow, /cancel-in-progress:\s*true/);
  assert.match(workflow, /ASTRO_TELEMETRY_DISABLED:\s*['\"]?1/);
  assert.match(workflow, /actions\/checkout@v5/);
  assert.match(workflow, /actions\/setup-node@v4/);
  assert.match(workflow, /node-version:\s*22/);
  assert.match(workflow, /cache:\s*npm/);
  assert.match(workflow, /run:\s*npm ci/);
  assert.match(workflow, /run:\s*npm run check/);
  assert.match(workflow, /run:\s*npm run test:unit/);
  assert.match(workflow, /run:\s*npm run build/);
  assert.match(workflow, /run:\s*npm run test:static/);
  assert.match(workflow, /actions\/configure-pages@v5/);
  assert.match(workflow, /actions\/upload-pages-artifact@v4/);
  assert.match(workflow, /path:\s*['\"]?dist\/?.*$/m);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /needs:\s*build/);
  assert.doesNotMatch(workflow, /peaceiris\/actions-gh-pages|JamesIves\/github-pages-deploy-action/i);
});
