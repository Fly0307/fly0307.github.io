import { handleSetup, loadCredentials } from './setup';
import type { WorkerBindings } from './bindings';

export type AuthEnvironment = Pick<WorkerBindings, 'SITE_ORIGIN' | 'GITHUB_CLIENT_ID' | 'REPOSITORY_ID' | 'STATE_SECRET'> & {
  GITHUB_CLIENT_SECRET?: string;
  APP_CONFIG?: { get(key: string): Promise<string | null>; put(key: string, value: string): Promise<void> };
};

interface Proof {
  state: string;
  challenge: string;
  expires: number;
  nonce?: string;
  codeHash?: string;
}

const cookieName = '__Host-orbital-oauth';
const repo = 'Fly0307/fly0307.github.io';
const encoder = new TextEncoder();
const json = (value: unknown, status = 200, extra: HeadersInit = {}) => new Response(JSON.stringify(value), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', ...extra },
});

function base64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unbase64(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}

async function digest(text: string) { return base64(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)))); }
function nonce() { return base64(crypto.getRandomValues(new Uint8Array(32))); }

async function key(secret: string) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function seal(value: Proof, secret: string) {
  const payload = base64(encoder.encode(JSON.stringify(value)));
  const signature = base64(new Uint8Array(await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(payload))));
  return `${payload}.${signature}`;
}

async function open(value: string, secret: string): Promise<Proof> {
  if (value.length > 3000) throw new Error('invalid proof');
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra || !await crypto.subtle.verify('HMAC', await key(secret), unbase64(signature), encoder.encode(payload))) throw new Error('invalid signature');
  const data: unknown = JSON.parse(new TextDecoder().decode(unbase64(payload)));
  if (!data || typeof data !== 'object' || !('state' in data) || typeof data.state !== 'string'
    || !('challenge' in data) || typeof data.challenge !== 'string'
    || !('expires' in data) || typeof data.expires !== 'number' || data.expires < Date.now()) throw new Error('expired proof');
  return data as Proof;
}

async function configuration(env: AuthEnvironment) {
  const origin = new URL(env.SITE_ORIGIN);
  if (origin.protocol !== 'https:' || origin.origin !== env.SITE_ORIGIN
    || !env.STATE_SECRET || env.STATE_SECRET.length < 32
    || !/^\d+$/.test(env.REPOSITORY_ID)) throw new Error('missing configuration');
  const stored = (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) ? await loadCredentials(env) : null;
  const clientId = stored?.clientId || env.GITHUB_CLIENT_ID;
  const clientSecret = stored?.clientSecret || env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('missing app configuration');
  return { origin: origin.origin, clientId, clientSecret };
}

function redirect(url: string, cookie: string) {
  return new Response(null, { status: 302, headers: {
    Location: url, 'Set-Cookie': cookie, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
  } });
}

export function createAuthWorker(upstream: typeof fetch = fetch) {
  return {
    async fetch(request: Request, env: AuthEnvironment): Promise<Response> {
      const url = new URL(request.url);
      if (url.pathname.startsWith('/setup/')) return handleSetup(request, env, upstream, { seal, open });
      let origin: string;
      let clientId: string;
      let clientSecret: string;
      try { ({ origin, clientId, clientSecret } = await configuration(env)); }
      catch { return json({ error: 'Authorization service is not configured.' }, 503); }
      const callback = `${url.origin}/callback`;
      const cors = { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
      if (url.pathname === '/exchange' && request.method === 'OPTIONS') {
        if (request.headers.get('Origin') !== origin) return json({ error: 'Forbidden origin' }, 403);
        return new Response(null, { status: 204, headers: {
          ...cors, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Cache-Control': 'no-store',
        } });
      }
      if (url.pathname === '/health' && request.method === 'GET') return json({ configured: true });
      try {
        if (url.pathname === '/auth' && request.method === 'GET') {
          const state = url.searchParams.get('state') ?? '';
          const challenge = url.searchParams.get('code_challenge') ?? '';
          if (!/^[a-f0-9]{64}$/.test(state) || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) return json({ error: 'Invalid login request' }, 400);
          const oauthState = nonce();
          const proof = await seal({ state, challenge, nonce: oauthState, expires: Date.now() + 600000 }, env.STATE_SECRET);
          const github = new URL('https://github.com/login/oauth/authorize');
          github.search = new URLSearchParams({ client_id: clientId, redirect_uri: callback, state: oauthState, code_challenge: challenge, code_challenge_method: 'S256', login: 'Fly0307', allow_signup: 'false' }).toString();
          // A GitHub App takes its permissions from its installation; request no broad OAuth scopes.
          return redirect(github.href, `${cookieName}=${proof}; Path=/; Max-Age=600; Secure; HttpOnly; SameSite=Lax`);
        }
        if (url.pathname === '/callback' && request.method === 'GET') {
          const stored = request.headers.get('Cookie')?.split(';').map(value => value.trim()).find(value => value.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) ?? '';
          const proof = await open(stored, env.STATE_SECRET);
          if (!proof.nonce || proof.nonce !== url.searchParams.get('state')) throw new Error('state mismatch');
          const target = new URL('/admin/', origin);
          target.searchParams.set('oauth_state', proof.state);
          const code = url.searchParams.get('code');
          if (url.searchParams.has('error') || !code) target.searchParams.set('oauth_error', 'denied');
          else {
            target.searchParams.set('oauth_code', code);
            target.searchParams.set('oauth_ticket', await seal({ state: proof.state, challenge: proof.challenge, codeHash: await digest(code), expires: Date.now() + 300000 }, env.STATE_SECRET));
          }
          return redirect(target.href, `${cookieName}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax`);
        }
        if (url.pathname === '/exchange' && request.method === 'POST') {
          if (request.headers.get('Origin') !== origin) return json({ error: 'Forbidden origin' }, 403);
          if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({ error: 'JSON required' }, 415, cors);
          const body = await request.text();
          if (body.length > 8192) return json({ error: 'Request too large' }, 413, cors);
          const data: unknown = JSON.parse(body);
          if (!data || typeof data !== 'object' || !('ticket' in data) || typeof data.ticket !== 'string'
            || !('state' in data) || typeof data.state !== 'string' || !('code' in data) || typeof data.code !== 'string'
            || !('verifier' in data) || typeof data.verifier !== 'string' || !/^[a-f0-9]{64}$/.test(data.verifier)) throw new Error('invalid exchange');
          const proof = await open(data.ticket, env.STATE_SECRET);
          if (proof.state !== data.state || proof.codeHash !== await digest(data.code) || proof.challenge !== await digest(data.verifier)) throw new Error('PKCE mismatch');
          const tokenResponse = await upstream('https://github.com/login/oauth/access_token', {
            method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
            body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code: data.code, code_verifier: data.verifier, redirect_uri: callback, repository_id: env.REPOSITORY_ID }),
          });
          if (!tokenResponse.ok) throw new Error('token exchange failed');
          const token: unknown = await tokenResponse.json();
          if (!token || typeof token !== 'object' || !('access_token' in token) || typeof token.access_token !== 'string') throw new Error('no access token');
          const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token.access_token}`, 'User-Agent': 'Orbital-Archive-Admin', 'X-GitHub-Api-Version': '2022-11-28' };
          const userResponse = await upstream('https://api.github.com/user', { headers, signal: AbortSignal.timeout(15000) });
          if (!userResponse.ok) throw new Error('identity unavailable');
          const user: unknown = await userResponse.json();
          if (!user || typeof user !== 'object' || !('login' in user) || typeof user.login !== 'string' || user.login.toLowerCase() !== 'fly0307') return json({ error: 'Only the site owner may sign in.' }, 403, cors);
          const repoResponse = await upstream(`https://api.github.com/repos/${repo}`, { headers, signal: AbortSignal.timeout(15000) });
          if (!repoResponse.ok) throw new Error('repository unavailable');
          const repository: unknown = await repoResponse.json();
          if (!repository || typeof repository !== 'object' || !('id' in repository) || String(repository.id) !== env.REPOSITORY_ID) throw new Error('repository mismatch');
          // Tokens and refresh tokens are never stored; only return the short-lived access token to the exact site origin.
          return json({ access_token: token.access_token }, 200, cors);
        }
        return json({ error: 'Not found' }, 404);
      } catch {
        return json({ error: 'Authorization could not be verified. Please restart sign-in.' }, 400, url.pathname === '/exchange' ? cors : {});
      }
    },
  };
}

export default createAuthWorker();
