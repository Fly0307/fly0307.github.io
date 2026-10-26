import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuthWorker, type AuthEnvironment } from '../auth-worker/worker';
import { loadCredentials, storeCredentials } from '../auth-worker/setup';

const secret = 'test-only-bootstrap-signing-secret-32-characters';
const origin = 'https://auth.example.workers.dev';
const state = 'a'.repeat(64);
function environment(): AuthEnvironment {
  const values = new Map<string, string>();
  return { SITE_ORIGIN: 'https://fly0307.github.io', GITHUB_CLIENT_ID: '', REPOSITORY_ID: '479644999', STATE_SECRET: secret,
    APP_CONFIG: { async get(key) { return values.get(key) ?? null; }, async put(key, value) { values.set(key, value); } } };
}
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function ticket(expires = Date.now() + 60000) {
  const encoder = new TextEncoder();
  const payload = encode(encoder.encode(JSON.stringify({ state, challenge: 'github-app-setup', expires })));
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return `${payload}.${encode(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload))))}`;
}
const app = { owner: { login: 'Fly0307' }, slug: 'fly0307-orbital-archive', client_id: 'test-client', client_secret: 'test-app-secret', pem: 'unused-private-key' };

test('setup requires a signed, unexpired ticket and sets a secure HTTP-only cookie', async () => {
  const worker = createAuthWorker(); const env = environment();
  for (const value of ['forged', await ticket(Date.now() - 1)]) assert.equal((await worker.fetch(new Request(`${origin}/setup/start?ticket=${value}`), env)).status, 400);
  const start = await worker.fetch(new Request(`${origin}/setup/start?ticket=${await ticket()}`), env);
  const html = await start.text();
  assert.equal(start.status, 200);
  assert.match(start.headers.get('Set-Cookie')!, /Secure; HttpOnly; SameSite=Lax/);
  assert.match(html, /Fly0307/);
  assert.match(html, /contents/);
  assert.doesNotMatch(html, /test-app-secret|unused-private-key/);
});

test('manifest callback validates owner and state, stores only encrypted credentials, and redirects to installation', async () => {
  const env = environment();
  const worker = createAuthWorker(async () => new Response(JSON.stringify(app)));
  const start = await worker.fetch(new Request(`${origin}/setup/start?ticket=${await ticket()}`), env);
  const cookie = start.headers.get('Set-Cookie')!.split(';')[0];
  const failed = await worker.fetch(new Request(`${origin}/setup/callback?code=code&state=wrong`, { headers: { Cookie: cookie } }), env);
  assert.equal(failed.status, 400);
  assert.equal(await env.APP_CONFIG!.get('github-app'), null);
  const result = await worker.fetch(new Request(`${origin}/setup/callback?code=code&state=${state}`, { headers: { Cookie: cookie } }), env);
  assert.equal(result.status, 302);
  assert.equal(result.headers.get('Location'), 'https://github.com/apps/fly0307-orbital-archive/installations/new');
  const stored = await env.APP_CONFIG!.get('github-app');
  assert.ok(stored && stored.startsWith('v1.'));
  assert.ok(!stored.includes('test-app-secret') && !stored.includes('unused-private-key'));
  assert.deepEqual(await loadCredentials(env), { clientId: app.client_id, clientSecret: app.client_secret, slug: app.slug });
  assert.equal((await worker.fetch(new Request(`${origin}/setup/start?ticket=${await ticket()}`), env)).status, 409);
  assert.equal((await worker.fetch(new Request(`${origin}/health`), env)).status, 200);
});

test('another GitHub account cannot provision this site and altered encryption cannot be read', async () => {
  const env = environment();
  const worker = createAuthWorker(async () => new Response(JSON.stringify({ ...app, owner: { login: 'someone' } })));
  const start = await worker.fetch(new Request(`${origin}/setup/start?ticket=${await ticket()}`), env);
  const result = await worker.fetch(new Request(`${origin}/setup/callback?code=code&state=${state}`, { headers: { Cookie: start.headers.get('Set-Cookie')!.split(';')[0] } }), env);
  assert.equal(result.status, 400);
  assert.equal(await env.APP_CONFIG!.get('github-app'), null);
  await storeCredentials(env, { clientId: app.client_id, clientSecret: app.client_secret, slug: app.slug });
  await assert.rejects(loadCredentials({ ...env, STATE_SECRET: 'different-test-secret-over-32-characters' }));
});
