import { decodeText, encodeBase64, postDirectory, record, writablePath } from './model';

export const repository = 'Fly0307/fly0307.github.io';
export const branch = 'main';
const base = `https://api.github.com/repos/${repository}`;

export class GitHubError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export interface RepositoryFile { path: string; sha: string; text: string }
export interface SavedFile { sha: string; commitSha: string; commitUrl: string }
export interface Deployment { status: string; conclusion: string | null; url: string }

function string(value: unknown): string {
  if (typeof value !== 'string') throw new Error('GitHub 返回了不完整的数据，请重试。');
  return value;
}

export class GitHubClient {
  #token: string;
  #writing = false;
  constructor(token: string, private readonly request: typeof fetch = fetch) {
    this.#token = token.trim();
    if (!this.#token) throw new Error('请填写 GitHub 令牌。');
  }

  disconnect() { this.#token = ''; }

  private async api(url: string, init: RequestInit = {}, authenticated = true): Promise<unknown> {
    if (!this.#token) throw new Error('请重新登录。');
    let response: Response;
    try {
      // Native browser fetch must not receive the GitHubClient as its receiver.
      const request = this.request;
      response = await request(url, {
        ...init,
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        signal: AbortSignal.timeout(25000),
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(authenticated ? { Authorization: `Bearer ${this.#token}` } : {}),
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        },
      });
    } catch {
      throw new Error(init.method === 'PUT'
        ? '网络中断，写入结果尚不确定。请先在 GitHub 查看该文件，确认是否保存成功，再重新加载；当前编辑内容仍保留。'
        : '无法连接 GitHub，请检查网络后重试。');
    }
    if (!response.ok) {
      const messages: Record<number, string> = {
        401: '令牌无效或已过期，请退出后重新登录。',
        403: 'GitHub 拒绝访问，请检查令牌的仓库选择、Contents 写入权限或 API 额度。',
        404: '文件或仓库不可访问，请检查令牌是否授权 fly0307.github.io。',
        409: '文件已被其他操作修改，本次保存未覆盖它。请下载备份，再重新加载后合并。',
        422: 'GitHub 拒绝写入；文件可能已存在或受分支保护限制。请先检查仓库，再重新加载。',
      };
      throw new GitHubError(response.status, messages[response.status] ?? `GitHub 请求失败（${response.status}），请稍后重试。`);
    }
    return response.json();
  }

  async login(): Promise<string> {
    const user = record(await this.api('https://api.github.com/user'));
    const login = string(user.login);
    if (login.toLowerCase() !== 'fly0307') { this.disconnect(); throw new Error('此后台仅允许站点所有者 Fly0307 登录。'); }
    const repo = record(await this.api(base));
    if (string(repo.full_name).toLowerCase() !== repository.toLowerCase()) throw new Error('仓库不匹配。');
    const permissions = record(repo.permissions);
    if (permissions.push !== true) throw new Error('当前账号没有此仓库的写入权限。');
    return login;
  }

  async posts(): Promise<string[]> {
    const tree = record(await this.api(`${base}/git/trees/${branch}?recursive=1`));
    if (tree.truncated === true || !Array.isArray(tree.tree)) throw new Error('文章列表不完整，请在 GitHub 中管理文章。');
    return tree.tree.map(record).filter(item => item.type === 'blob' && typeof item.path === 'string'
      && item.path.startsWith(postDirectory) && item.path.endsWith('.md') && writablePath(item.path))
      .map(item => string(item.path)).sort();
  }

  async read(path: string): Promise<RepositoryFile> {
    if (!writablePath(path)) throw new Error('不支持读取此文件。');
    const file = record(await this.api(`${base}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${branch}`));
    if (file.encoding !== 'base64') throw new Error('文件过大或不是可编辑的文本。');
    return { path, sha: string(file.sha), text: decodeText(string(file.content)) };
  }

  async save(path: string, content: string | Uint8Array, message: string, sha?: string): Promise<SavedFile> {
    if (!writablePath(path)) throw new Error('后台只允许写入文章、站点资料或上传图片目录。');
    if (this.#writing) throw new Error('上一项保存尚未完成，请稍候。');
    this.#writing = true;
    try {
      const result = record(await this.api(`${base}/contents/${path.split('/').map(encodeURIComponent).join('/')}`, {
        method: 'PUT',
        body: JSON.stringify({ message, branch, content: encodeBase64(typeof content === 'string' ? new TextEncoder().encode(content) : content), ...(sha ? { sha } : {}) }),
      }));
      const commitSha = string(record(result.commit).sha);
      return { sha: string(record(result.content).sha), commitSha, commitUrl: `https://github.com/${repository}/commit/${commitSha}` };
    } finally { this.#writing = false; }
  }

  async deployment(commitSha: string): Promise<Deployment | null> {
    // Public workflow metadata needs no extra token permission.
    const result = record(await this.api(`${base}/actions/workflows/deploy.yml/runs?branch=${branch}&per_page=30`, {}, false));
    if (!Array.isArray(result.workflow_runs)) throw new Error('部署状态暂不可用。');
    const run = result.workflow_runs.map(record).find(item => item.head_sha === commitSha);
    return run ? {
      status: string(run.status),
      conclusion: typeof run.conclusion === 'string' ? run.conclusion : null,
      url: `https://github.com/${repository}/actions/runs/${Number(run.id)}`,
    } : null;
  }
}
