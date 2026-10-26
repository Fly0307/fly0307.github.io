import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const output = new URL('auth-worker/bindings.d.ts', root);
execFileSync(process.execPath, [fileURLToPath(new URL('node_modules/wrangler/bin/wrangler.js', root)), 'types', fileURLToPath(output), '--env-interface', 'WorkerBindings', '--config', fileURLToPath(new URL('auth-worker/wrangler.toml', root)), '--strict-vars=false', '--include-runtime=false'], { stdio: 'inherit' });
// Keep the generated Workers namespace module-scoped so it cannot replace browser DOM types.
const generated = readFileSync(output, 'utf8');
writeFileSync(output, `import type { KVNamespace } from '@cloudflare/workers-types';\n${generated}\nexport type { WorkerBindings };\n`);
