import assert from 'node:assert/strict';
import test from 'node:test';
import { challenge } from '../src/admin/auth';
import { createAuthWorker, type AuthEnvironment } from '../auth-worker/worker';

const env: AuthEnvironment = {
  SITE_ORIGIN: 'https://fly0307.github.io', GITHUB_CLIENT_ID: 'test-app-id', GITHUB_CLIENT_SECRET: 'test-secret-placeholder',
  STATE_SECRET: 'test-signing-key-placeholder-minimum-32-characters', REPOSITORY_ID: '479644999',
};
const verifier = 'b'.repeat(64);
const state = 'a'.repeat(64);
const workerOrigin = 'https://auth.example.workers.dev';
const response = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });

async function authorize(worker = createAuthWorker()) {
  const start = await worker.fetch(new Request(`${workerOrigin}/auth?state=${state}&code_challenge=${await challenge(verifier)}`), env);
  assert.equal(start.status, 302);
  const github = new URL(start.headers.get('Location')!);
  assert.equal(github.origin, 'https://github.com');
  assert.equal(github.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(github.searchParams.get('scope'), null);
  const cookie = start.headers.get('Set-Cookie')!;
  assert.match(cookie, /Secure; HttpOnly; SameSite=Lax/);
  return { github, cookie: cookie.split(';')[0] };
}

async function callback(worker = createAuthWorker()) {
  const { github, cookie } = await authorize(worker);
  const result = await worker.fetch(new Request(`${workerOrigin}/callback?code=temporary-code&state=${github.searchParams.get('state')}`, { headers: { Cookie: cookie } }), env);
  assert.equal(result.status, 302);
  const url = new URL(result.headers.get('Location')!);
  assert.equal(url.origin, env.SITE_ORIGIN);
  assert.equal(url.pathname, '/admin/');
  assert.equal(url.searchParams.has('access_token'), false);
  assert.match(result.headers.get('Set-Cookie')!, /Max-Age=0/);
  return { code: url.searchParams.get('oauth_code'), state: url.searchParams.get('oauth_state'), ticket: url.searchParams.get('oauth_ticket'), verifier };
}

function exchange(body: unknown, origin = env.SITE_ORIGIN) {
  return new Request(`${workerOrigin}/exchange`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

test('OAuth uses PKCE and redirects through GitHub without broad OAuth scopes or access tokens in URLs', async () => { await callback(); });

test('OAuth rejects missing configuration and malformed authorization requests', async () => {
  const worker = createAuthWorker();
  assert.equal((await worker.fetch(new Request(`${workerOrigin}/health`), { ...env, STATE_SECRET: '' })).status, 503);
  assert.equal((await worker.fetch(new Request(`${workerOrigin}/auth?state=bad&code_challenge=bad`), env)).status, 400);
});

test('callback rejects missing, forged and expired cookies and OAuth state mismatches', async () => {
  const worker = createAuthWorker();
  const { cookie } = await authorize(worker);
  const cases: HeadersInit[] = [{}, { Cookie: '__Host-orbital-oauth=forged' }, { Cookie: cookie }];
  for (const headers of cases) {
    assert.equal((await worker.fetch(new Request(`${workerOrigin}/callback?code=anything&state=wrong`, { headers }), env)).status, 400);
  }
  const { github } = await authorize(worker);
  assert.equal((await worker.fetch(new Request(`${workerOrigin}/callback?code=x&state=${github.searchParams.get('state')}`, { headers: { Cookie: cookie } }), { ...env, STATE_SECRET: 'rotated-placeholder-key-over-32-characters' })).status, 400);
});

test('denied consent returns an explicit error without exchanging a token', async () => {
  const worker = createAuthWorker(async () => { throw new Error('must not call upstream'); });
  const { github, cookie } = await authorize(worker);
  const result = await worker.fetch(new Request(`${workerOrigin}/callback?error=access_denied&state=${github.searchParams.get('state')}`, { headers: { Cookie: cookie } }), env);
  const url = new URL(result.headers.get('Location')!);
  assert.equal(url.searchParams.get('oauth_error'), 'denied');
  assert.equal(url.searchParams.has('oauth_code'), false);
});

test('exchange rejects other origins, tampering, mismatched state and incorrect PKCE', async () => {
  let called = false;
  const worker = createAuthWorker(async () => { called = true; return response({}); });
  const proof = await callback(worker);
  assert.equal((await worker.fetch(exchange(proof, 'https://attacker.example'), env)).status, 403);
  for (const body of [{ ...proof, state: 'c'.repeat(64) }, { ...proof, verifier: 'd'.repeat(64) }, { ...proof, code: 'stolen-code' }, { ...proof, ticket: proof.ticket + 'tampered' }]) {
    assert.equal((await worker.fetch(exchange(body), env)).status, 400);
  }
  assert.equal(called, false);
});

test('exchange verifies owner and repository before returning a token only to the configured origin', async () => {
  let calls = 0;
  const worker = createAuthWorker(async (url, init) => {
    calls++;
    if (String(url).includes('access_token')) {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.code_verifier, verifier);
      assert.equal(body.repository_id, env.REPOSITORY_ID);
      assert.equal(body.client_secret, env.GITHUB_CLIENT_SECRET);
      return response({ access_token: 'test-issued-token', refresh_token: 'must-not-return' });
    }
    if (String(url).endsWith('/user')) return response({ login: 'Fly0307' });
    return response({ id: Number(env.REPOSITORY_ID) });
  });
  const result = await worker.fetch(exchange(await callback(worker)), env);
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('Access-Control-Allow-Origin'), env.SITE_ORIGIN);
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await result.json(), { access_token: 'test-issued-token' });
  assert.equal(calls, 3);
});

test('a different GitHub user is rejected by the authorization server', async () => {
  const worker = createAuthWorker(async url => response(String(url).includes('access_token') ? { access_token: 'test-issued-token' } : { login: 'someone-else' }));
  assert.equal((await worker.fetch(exchange(await callback(worker)), env)).status, 403);
});

test('CORS preflight permits only the exact website origin', async () => {
  const worker = createAuthWorker();
  const preflight = (origin: string) => new Request(`${workerOrigin}/exchange`, { method: 'OPTIONS', headers: { Origin: origin } });
  const allowed = await worker.fetch(preflight(env.SITE_ORIGIN), env);
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), env.SITE_ORIGIN);
  assert.equal((await worker.fetch(preflight('https://other.example'), env)).status, 403);
});
