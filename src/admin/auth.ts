import config from '../data/admin-config.json';
import { record } from './model';

const pendingKey = 'orbital-oauth-pending';

function serviceUrl(): URL {
  if (!config.authServiceUrl) throw new Error('GitHub 登录尚未启用。请先按后台使用说明部署授权服务，并填写其地址。');
  const url = new URL(config.authServiceUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('授权服务必须使用不带路径和凭据的 HTTPS 地址。');
  }
  return url;
}

function random() { return Array.from(crypto.getRandomValues(new Uint8Array(32)), value => value.toString(16).padStart(2, '0')).join(''); }

export async function challenge(verifier: string): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  return btoa(String.fromCharCode(...hash)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function oauthConfigured() { return Boolean(config.authServiceUrl); }

export async function startGitHubLogin(): Promise<void> {
  const url = serviceUrl();
  const verifier = random();
  const state = random();
  // Only short-lived proof values live in sessionStorage, never an access token.
  sessionStorage.setItem(pendingKey, JSON.stringify({ verifier, state, expires: Date.now() + 600000 }));
  url.pathname = '/auth';
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', await challenge(verifier));
  window.location.assign(url.href);
}

export async function finishGitHubLogin(): Promise<string | null> {
  const url = new URL(window.location.href);
  if (!['oauth_state', 'oauth_code', 'oauth_ticket', 'oauth_error'].some(key => url.searchParams.has(key))) return null;
  const state = url.searchParams.get('oauth_state');
  const code = url.searchParams.get('oauth_code');
  const ticket = url.searchParams.get('oauth_ticket');
  const denied = url.searchParams.has('oauth_error');
  for (const key of ['oauth_state', 'oauth_code', 'oauth_ticket', 'oauth_error']) url.searchParams.delete(key);
  history.replaceState(null, '', url.pathname + url.search + url.hash);
  const pending = sessionStorage.getItem(pendingKey);
  sessionStorage.removeItem(pendingKey);
  if (!pending) throw new Error('登录验证信息不存在，请重新点击“使用 GitHub 登录”。');
  const proof = record(JSON.parse(pending));
  if (typeof proof.state !== 'string' || state !== proof.state || typeof proof.verifier !== 'string'
    || typeof proof.expires !== 'number' || proof.expires < Date.now()) throw new Error('登录验证已失效，请重新登录。');
  if (denied) throw new Error('GitHub 授权已取消，你可以重新点击登录。');
  if (!code || !ticket) throw new Error('授权回调不完整，请重新登录。');
  const endpoint = serviceUrl();
  endpoint.pathname = '/exchange';
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(25000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, ticket, state, verifier: proof.verifier }),
    });
  } catch { throw new Error('暂时无法连接授权服务，请稍后重新登录。'); }
  if (!response.ok) throw new Error('GitHub 授权未完成，请确认应用已安装到此仓库后重新登录。');
  const data = record(await response.json());
  if (typeof data.access_token !== 'string' || !data.access_token) throw new Error('授权服务未返回有效登录信息。');
  return data.access_token;
}
