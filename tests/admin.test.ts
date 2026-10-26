import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { GitHubClient, GitHubError } from '../src/admin/github';
import { decodeText, encodeBase64, imageExtension, parsePost, postPath, serializePost, siteContentPath, writablePath, type PostFields } from '../src/admin/model';
import { siteContentSchema } from '../src/lib/site-content';

const fields: PostFields = {
  title: '标题: "测试"', description: '文章摘要', publishedAt: '2026-10-26', updatedAt: '',
  language: 'zh', tags: 'Agent, 中文，Agent', featured: true, body: '\n## 内容\n\n测试正文。\n',
};
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

test('Markdown round trip preserves language, draft state and non-ASCII text', () => {
  const source = serializePost(fields, true);
  const parsed = parsePost(source);
  assert.equal(parsed.draft, true);
  assert.equal(parsed.fields.title, fields.title);
  assert.equal(parsed.fields.body, fields.body);
  assert.equal(parsed.fields.tags, 'Agent, 中文');
  assert.equal(parsePost(serializePost({ ...fields, language: 'en' }, false)).fields.language, 'en');
});

test('editing preserves unknown metadata, full timestamps, comments, and existing HTML', () => {
  const original = '---\n# original comment\ntitle: Old\ndescription: Summary\npublishedAt: 2026-10-26T13:14:15Z\nlanguage: zh\ncustom: [one, two]\n---\n\n<div class="memory-gallery"><img src="/photo.jpg"></div>\n';
  const parsed = parsePost(original);
  const updated = serializePost({ ...parsed.fields, title: 'New' }, false, original);
  assert.match(updated, /original comment/);
  assert.match(updated, /2026-10-26T13:14:15Z/);
  assert.match(updated, /custom:/);
  assert.equal(parsePost(updated).fields.body, parsed.fields.body);
});

test('existing memory article survives an editor round trip without losing its HTML body', async () => {
  const original = await readFile(new URL('../src/content/blog/shanshan.md', import.meta.url), 'utf8');
  const parsed = parsePost(original);
  assert.equal(parsePost(serializePost(parsed.fields, false, original)).fields.body, parsed.fields.body);
});

test('invalid date ranges, empty content, malformed YAML and aliases cannot be saved', () => {
  assert.throws(() => serializePost({ ...fields, updatedAt: '2020-01-01' }, false));
  assert.throws(() => serializePost({ ...fields, body: ' ' }, true));
  assert.throws(() => parsePost('---\ntitle: One\ntitle: Two\n---\ntext'));
  assert.throws(() => parsePost('---\nx: &x value\ntitle: *x\n---\ntext'));
  assert.doesNotThrow(() => serializePost({ ...fields, title: '', body: '' }, true, undefined, false));
});

test('editable paths are restricted and new article paths cannot overwrite the template', () => {
  assert.equal(postPath('my-first-post'), 'src/content/blog/my-first-post.md');
  assert.equal(writablePath('src/content/blog/notes/系统.md'), true);
  assert.equal(writablePath(siteContentPath), true);
  for (const path of ['.github/workflows/deploy.yml', 'src/data/site.ts', '../secret', 'src/content/blog/../site.ts', 'src/content/blog/blog-template.md', 'src/content/blog/%2e%2e.md', 'public/uploads/2026/10/script.svg']) assert.equal(writablePath(path), false, path);
  for (const slug of ['../attack', 'blog-template', 'UPPER', 'x/y', '']) assert.throws(() => postPath(slug));
});

test('text encoding handles Chinese and large UTF-8 content', () => {
  const text = '中文 👋'.repeat(10000);
  assert.equal(decodeText(encodeBase64(new TextEncoder().encode(text))), text);
});

test('image upload validates bytes as well as MIME and file size', () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(imageExtension('image/png', png), 'png');
  assert.throws(() => imageExtension('image/png', new TextEncoder().encode('<svg></svg>')));
  assert.throws(() => imageExtension('image/svg+xml', png));
  assert.throws(() => imageExtension('image/png', new Uint8Array(5 * 1024 * 1024 + 1)));
});

test('profile data validates links before they enter public templates', () => {
  const content = { name: 'Me', email: 'me@example.com', github: 'https://github.com/me', hero: { zh: '介绍', en: 'Intro' }, about: { zh: '关于', en: 'About' }, projects: [{ name: 'Project', url: 'javascript:alert(1)', zh: '中文', en: 'English' }] };
  assert.equal(siteContentSchema.safeParse(content).success, false);
  content.projects[0].url = 'https://example.com';
  assert.equal(siteContentSchema.safeParse(content).success, true);
});

test('GitHub login rejects other users and accounts without repository write access', async () => {
  const other = new GitHubClient('test-placeholder', async () => response({ login: 'someone' }));
  await assert.rejects(other.login(), /仅允许/);
  await assert.rejects(other.posts(), /重新登录/);
  let calls = 0;
  const readonly = new GitHubClient('test-placeholder', async () => response(++calls === 1 ? { login: 'Fly0307' } : { full_name: 'Fly0307/fly0307.github.io', permissions: { push: false } }));
  await assert.rejects(readonly.login(), /写入权限/);
});

test('GitHub writes use the loaded SHA, explicit main branch, UTF-8 base64 and fixed origin', async () => {
  const requests: { url: string; init?: RequestInit }[] = [];
  const client = new GitHubClient('test-placeholder', async (url, init) => {
    requests.push({ url: String(url), init });
    return response({ content: { sha: 'new-sha' }, commit: { sha: 'commit-sha' } });
  });
  const result = await client.save(postPath('test-post'), '中文', 'docs(blog): 保存草稿', 'original-sha');
  const body = JSON.parse(String(requests[0].init?.body));
  assert.equal(body.sha, 'original-sha');
  assert.equal(body.branch, 'main');
  assert.equal(decodeText(body.content), '中文');
  assert.ok(requests[0].url.startsWith('https://api.github.com/repos/Fly0307/fly0307.github.io/contents/'));
  assert.equal(requests[0].init?.credentials, 'omit');
  assert.equal(result.commitSha, 'commit-sha');
  await assert.rejects(client.save('.github/workflows/anything.yml', '', 'bad'));
  assert.equal(requests.length, 1);
});

test('native browser fetch is called without binding it to the client instance', async () => {
  const request: typeof fetch = async function(this: unknown) {
    assert.equal(this, undefined);
    return response({ truncated: false, tree: [] });
  };
  assert.deepEqual(await new GitHubClient('test-placeholder', request).posts(), []);
});

test('new file creation omits SHA and never retries conflicts or ambiguous network failures', async () => {
  let calls = 0;
  const conflict = new GitHubClient('test-placeholder', async (_url, init) => {
    calls++;
    assert.equal('sha' in JSON.parse(String(init?.body)), false);
    return response({}, 409);
  });
  await assert.rejects(conflict.save(postPath('new-post'), 'data', 'message'), (error: unknown) => error instanceof GitHubError && error.status === 409);
  assert.equal(calls, 1);
  const timeout = new GitHubClient('test-placeholder', async () => { throw new Error('timeout'); });
  await assert.rejects(timeout.save(postPath('new-post'), 'data', 'message'), /写入结果尚不确定/);
});

test('template is excluded and truncated article listings are rejected', async () => {
  const client = new GitHubClient('test-placeholder', async () => response({ tree: [
    { type: 'blob', path: 'src/content/blog/blog-template.md' },
    { type: 'blob', path: 'src/content/blog/post.md' },
    { type: 'blob', path: 'src/data/site.ts' },
  ], truncated: false }));
  assert.deepEqual(await client.posts(), ['src/content/blog/post.md']);
  const truncated = new GitHubClient('test-placeholder', async () => response({ tree: [], truncated: true }));
  await assert.rejects(truncated.posts(), /不完整/);
});

test('deployment status matches the exact saved commit and sends no token', async () => {
  const client = new GitHubClient('test-placeholder', async (_url, init) => {
    assert.equal(new Headers(init?.headers).has('Authorization'), false);
    return response({ workflow_runs: [{ head_sha: 'older', status: 'completed', conclusion: 'success', id: 10 }, { head_sha: 'current', status: 'in_progress', conclusion: null, id: 11 }] });
  });
  assert.equal((await client.deployment('current'))?.status, 'in_progress');
  assert.equal(await client.deployment('newer'), null);
});
