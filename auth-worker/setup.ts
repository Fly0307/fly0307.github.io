import type { AuthEnvironment } from './worker';

export interface AppCredentials { clientId: string; clientSecret: string; slug: string }
export interface SetupProof { state: string; challenge: string; expires: number }
interface ProofCodec {
  seal(value: SetupProof, secret: string): Promise<string>;
  open(value: string, secret: string): Promise<SetupProof>;
}
const appKey = 'github-app';
const cookieName = '__Host-orbital-setup';
const encoder = new TextEncoder();
function base64(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function bytes(text: string): Uint8Array<ArrayBuffer> { return Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)); }
async function encryptionKey(secret: string) {
  return crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', encoder.encode(secret)), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}
export async function storeCredentials(env: AuthEnvironment, credentials: AppCredentials) {
  if (!env.APP_CONFIG) throw new Error('setup storage unavailable');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(env.STATE_SECRET), encoder.encode(JSON.stringify(credentials)));
  await env.APP_CONFIG.put(appKey, `v1.${base64(iv)}.${base64(new Uint8Array(encrypted))}`);
}
export async function loadCredentials(env: AuthEnvironment): Promise<AppCredentials | null> {
  const stored = await env.APP_CONFIG?.get(appKey);
  if (!stored) return null;
  const [version, iv, payload, extra] = stored.split('.');
  if (version !== 'v1' || !iv || !payload || extra) throw new Error('invalid app configuration');
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(iv) }, await encryptionKey(env.STATE_SECRET), bytes(payload));
  const value: unknown = JSON.parse(new TextDecoder().decode(plaintext));
  if (!value || typeof value !== 'object' || !('clientId' in value) || typeof value.clientId !== 'string'
    || !('clientSecret' in value) || typeof value.clientSecret !== 'string' || !('slug' in value) || typeof value.slug !== 'string') throw new Error('invalid app configuration');
  return { clientId: value.clientId, clientSecret: value.clientSecret, slug: value.slug };
}
const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
function message(text: string, status = 400) {
  return new Response(text, { status, headers: { 'Content-Type': 'text/plain;charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}
export async function handleSetup(request: Request, env: AuthEnvironment, upstream: typeof fetch, codec: ProofCodec): Promise<Response> {
  const url = new URL(request.url);
  if (!env.APP_CONFIG || !env.STATE_SECRET || env.STATE_SECRET.length < 32 || env.SITE_ORIGIN !== 'https://fly0307.github.io') return message('注册服务尚未配置。', 503);
  if (request.method !== 'GET') return message('Method not allowed', 405);
  if (url.pathname === '/setup/installed') return new Response(null, { status: 302, headers: { Location: `${env.SITE_ORIGIN}/admin/`, 'Cache-Control': 'no-store' } });
  if (await env.APP_CONFIG.get(appKey)) return message('GitHub App 已完成配置。请返回主页后台使用 GitHub 登录。', 409);
  try {
    if (url.pathname === '/setup/start') {
      const ticket = url.searchParams.get('ticket') ?? '';
      const proof = await codec.open(ticket, env.STATE_SECRET);
      if (proof.challenge !== 'github-app-setup' || !/^[a-f0-9]{64}$/.test(proof.state)) throw new Error('invalid setup ticket');
      const manifest = {
        name: 'Fly0307 Orbital Archive', url: env.SITE_ORIGIN,
        redirect_url: `${url.origin}/setup/callback`, callback_urls: [`${url.origin}/callback`],
        setup_url: `${url.origin}/setup/installed`, public: false,
        description: 'Fly0307 personal homepage content editor',
        hook_attributes: { url: `${url.origin}/unused-webhook`, active: false },
        default_permissions: { contents: 'write' }, default_events: [], request_oauth_on_install: false,
      };
      const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>创建主页 GitHub 登录应用</title><h1>配置主页的 GitHub 登录</h1><p>请使用 <strong>Fly0307</strong> 账号创建此应用。下一步在 GitHub 确认应用名称，随后安装到 <strong>fly0307.github.io</strong> 这一个仓库。</p><p>应用配置和密钥将自动完成，不需要复制令牌或密钥。</p><form method="post" action="https://github.com/settings/apps/new?state=${proof.state}"><input type="hidden" name="manifest" value="${escape(JSON.stringify(manifest))}"><button type="submit">前往 GitHub 创建应用</button></form></html>`;
      return new Response(html, { headers: {
        'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': "default-src 'none'; form-action https://github.com; frame-ancestors 'none'; base-uri 'none'",
        'Set-Cookie': `${cookieName}=${ticket}; Path=/; Max-Age=3600; Secure; HttpOnly; SameSite=Lax`,
      } });
    }
    if (url.pathname === '/setup/callback') {
      const cookie = request.headers.get('Cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) ?? '';
      const proof = await codec.open(cookie, env.STATE_SECRET);
      const code = url.searchParams.get('code');
      if (proof.challenge !== 'github-app-setup' || proof.state !== url.searchParams.get('state') || !code || code.length > 512) throw new Error('setup state mismatch');
      const response = await upstream(`https://api.github.com/app-manifests/${encodeURIComponent(code)}/conversions`, {
        method: 'POST', headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Orbital-Archive-Setup', 'X-GitHub-Api-Version': '2022-11-28' }, signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error('manifest conversion failed');
      const app: unknown = await response.json();
      if (!app || typeof app !== 'object' || !('owner' in app) || !app.owner || typeof app.owner !== 'object'
        || !('login' in app.owner) || typeof app.owner.login !== 'string' || app.owner.login.toLowerCase() !== 'fly0307'
        || !('client_id' in app) || typeof app.client_id !== 'string' || !('client_secret' in app) || typeof app.client_secret !== 'string'
        || !('slug' in app) || typeof app.slug !== 'string' || !/^[a-z0-9-]+$/.test(app.slug)) throw new Error('app must belong to Fly0307');
      await storeCredentials(env, { clientId: app.client_id, clientSecret: app.client_secret, slug: app.slug });
      return new Response(null, { status: 302, headers: {
        Location: `https://github.com/apps/${app.slug}/installations/new`, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
        'Set-Cookie': `${cookieName}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax`,
      } });
    }
    return message('Not found', 404);
  } catch { return message('注册验证未通过或链接已过期，请使用新的注册链接重试。密钥不会在此页面显示。'); }
}
