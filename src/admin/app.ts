import { GitHubClient, type RepositoryFile, type SavedFile } from './github';
import { imageExtension, parsePost, postDirectory, postPath, serializePost, siteContentPath, type PostFields } from './model';
import { renderPreview } from './preview';
import { siteContentSchema, type SiteContent } from '../lib/site-content';
import { finishGitHubLogin, oauthConfigured, startGitHubLogin } from './auth';

function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (!value) throw new Error(`后台缺少必要元素：${id}`);
  return value as T;
}

function input(id: string) { return element<HTMLInputElement>(id); }
function today() { return new Date().toLocaleDateString('sv-SE'); }

export function initializeAdmin(): void {
  let client: GitHubClient | null = null;
  let file: RepositoryFile | null = null;
  let siteFile: RepositoryFile | null = null;
  let wasDraft = true;
  let postBaseline = '';
  let settingsBaseline = '';
  let activeTab: 'articles' | 'settings' = 'articles';
  let busy = false;
  let deployment: SavedFile | null = null;
  let polling: ReturnType<typeof setTimeout> | undefined;
  let polls = 0;
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;
  let previewTimer: ReturnType<typeof setTimeout> | undefined;
  const uploads = new Map<string, string>();
  const postForm = element<HTMLFormElement>('post-form');
  const settingsForm = element<HTMLFormElement>('settings-form');

  function fields(): PostFields {
    return {
      title: input('post-title').value,
      description: element<HTMLTextAreaElement>('post-description').value,
      publishedAt: input('post-date').value,
      updatedAt: input('post-updated').value,
      language: element<HTMLSelectElement>('post-language').value === 'en' ? 'en' : 'zh',
      tags: input('post-tags').value,
      featured: input('post-featured').checked,
      body: element<HTMLTextAreaElement>('post-body').value,
    };
  }

  function postSnapshot() { return JSON.stringify({ ...fields(), slug: input('post-slug').value }); }

  function siteFields(): SiteContent {
    const projects = Array.from(element('projects-editor').querySelectorAll<HTMLElement>('.project-editor')).map(card => {
      const value = (key: string) => card.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-project-field="${key}"]`)?.value ?? '';
      return { name: value('name'), url: value('url'), zh: value('zh'), en: value('en') };
    });
    const text = (id: string) => element<HTMLInputElement | HTMLTextAreaElement>(id).value;
    return {
      name: text('site-name'), email: text('site-email'), github: text('site-github'),
      hero: { zh: text('site-hero-zh'), en: text('site-hero-en') },
      about: { zh: text('site-about-zh'), en: text('site-about-en') },
      projects,
    };
  }

  function dirtyPost() { return Boolean(postBaseline && postSnapshot() !== postBaseline); }
  function dirtySettings() { return Boolean(settingsBaseline && JSON.stringify(siteFields()) !== settingsBaseline); }
  function mayLeave(changed: boolean) { return !changed || window.confirm('有尚未保存的修改，确定放弃这些修改吗？文章可先点击“下载备份”。'); }

  function tell(message: string, error = false) {
    clearTimeout(noticeTimer);
    element('status').hidden = true;
    element('error').hidden = true;
    const target = element(error ? 'error' : 'status');
    target.textContent = message;
    target.hidden = false;
    if (!error) noticeTimer = setTimeout(() => { target.hidden = true; }, 7000);
  }

  function connection() {
    if (!client) throw new Error('请先连接 GitHub。');
    return client;
  }

  async function action(task: () => Promise<void>) {
    if (busy) return;
    busy = true;
    element<HTMLFieldSetElement>('post-fields').disabled = true;
    element<HTMLFieldSetElement>('settings-fields').disabled = true;
    document.querySelectorAll<HTMLButtonElement>('.studio-sidebar button, #login-form button, #github-login').forEach(button => { button.disabled = true; });
    element('admin-main').setAttribute('aria-busy', 'true');
    element('error').hidden = true;
    try { await task(); }
    catch (error) { tell(error instanceof Error ? error.message : '操作失败，请稍后重试。', true); }
    finally {
      busy = false;
      element<HTMLFieldSetElement>('post-fields').disabled = false;
      element<HTMLFieldSetElement>('settings-fields').disabled = false;
      document.querySelectorAll<HTMLButtonElement>('.studio-sidebar button, #login-form button, #github-login').forEach(button => { button.disabled = false; });
      element('admin-main').removeAttribute('aria-busy');
    }
  }

  function preview() { renderPreview(element('post-preview'), fields().body, uploads); }

  function markPost() {
    const state = dirtyPost() ? '有未保存修改' : file ? (wasDraft ? '已保存草稿' : '已发布版本') : '尚未保存';
    element('post-state').textContent = state;
  }

  function switchTab(tab: 'articles' | 'settings') {
    activeTab = tab;
    element('articles-panel').hidden = tab !== 'articles';
    element('settings-panel').hidden = tab !== 'settings';
    element('article-navigation').hidden = tab !== 'articles';
    element('articles-tab').setAttribute('aria-pressed', String(tab === 'articles'));
    element('settings-tab').setAttribute('aria-pressed', String(tab === 'settings'));
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function populatePost(data?: RepositoryFile) {
    const parsed = data ? parsePost(data.text) : null;
    file = data ?? null;
    wasDraft = parsed?.draft ?? true;
    const post = parsed?.fields ?? { title: '', description: '', publishedAt: today(), updatedAt: '', language: 'zh', tags: '', featured: false, body: '' };
    input('post-title').value = post.title;
    input('post-slug').value = data ? data.path.slice(postDirectory.length, -3) : '';
    input('post-slug').readOnly = Boolean(data);
    element<HTMLTextAreaElement>('post-description').value = post.description;
    input('post-date').value = post.publishedAt;
    input('post-updated').value = post.updatedAt;
    element<HTMLSelectElement>('post-language').value = post.language;
    input('post-tags').value = post.tags;
    input('post-featured').checked = post.featured;
    element<HTMLTextAreaElement>('post-body').value = post.body;
    postBaseline = postSnapshot();
    element('editor-heading').textContent = data ? '编辑文章' : '新建文章';
    element('reload-post').hidden = !data;
    element('publish-post').textContent = data && !wasDraft ? '保存并发布' : '发布文章';
    const view = element<HTMLAnchorElement>('view-post');
    view.hidden = !data || wasDraft;
    if (data) view.href = `/blog/${data.path.slice(postDirectory.length, -3).split('/').map(encodeURIComponent).join('/')}/`;
    element('post-list').querySelectorAll<HTMLButtonElement>('button').forEach(button => {
      button.setAttribute('aria-current', String(button.dataset.path === data?.path));
    });
    markPost();
    preview();
  }

  function populateList(paths: string[]) {
    const list = element('post-list');
    list.replaceChildren();
    if (!paths.length) { const empty = document.createElement('p'); empty.className = 'muted'; empty.textContent = '还没有文章，从新建开始。'; list.append(empty); }
    for (const path of paths) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.path = path;
      button.textContent = path.slice(postDirectory.length, -3);
      button.setAttribute('aria-current', String(file?.path === path));
      button.addEventListener('click', () => {
        if (!mayLeave(dirtyPost())) return;
        void action(async () => { populatePost(await connection().read(path)); switchTab('articles'); });
      });
      list.append(button);
    }
  }

  function projectCard(project: SiteContent['projects'][number]) {
    const card = document.createElement('div');
    card.className = 'project-editor';
    const controls = document.createElement('div');
    controls.className = 'project-controls';
    const heading = document.createElement('strong');
    heading.textContent = project.name || '新项目';
    controls.append(heading);
    for (const [title, direction] of [['上移', -1], ['下移', 1], ['移除', 0]] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = title;
      button.setAttribute('aria-label', `${title}项目：${project.name || '新项目'}`);
      button.addEventListener('click', () => {
        if (direction === -1 && card.previousElementSibling) card.previousElementSibling.before(card);
        if (direction === 1 && card.nextElementSibling) card.nextElementSibling.after(card);
        if (direction === 0 && window.confirm('从项目展示中移除此项目？保存资料后才会生效。')) card.remove();
      });
      controls.append(button);
    }
    card.append(controls);
    const grid = document.createElement('div');
    grid.className = 'field-grid';
    for (const [key, title] of [['name', '项目名称'], ['url', '项目链接'], ['zh', '简介 · 中文'], ['en', '简介 · English']] as const) {
      const label = document.createElement('label');
      label.append(document.createTextNode(title));
      const field = key === 'zh' || key === 'en' ? document.createElement('textarea') : document.createElement('input');
      if (field instanceof HTMLInputElement && key === 'url') field.type = 'url';
      if (field instanceof HTMLTextAreaElement) field.rows = 3;
      field.dataset.projectField = key;
      field.required = true;
      field.value = project[key];
      if (key === 'name') field.addEventListener('input', () => { heading.textContent = field.value || '新项目'; });
      label.append(field);
      grid.append(label);
    }
    card.append(grid);
    return card;
  }

  function populateSettings(data: RepositoryFile) {
    const content = siteContentSchema.parse(JSON.parse(data.text));
    siteFile = data;
    input('site-name').value = content.name;
    input('site-email').value = content.email;
    input('site-github').value = content.github;
    for (const key of ['hero', 'about'] as const) {
      for (const language of ['zh', 'en'] as const) element<HTMLTextAreaElement>(`site-${key}-${language}`).value = content[key][language];
    }
    element('projects-editor').replaceChildren(...content.projects.map(projectCard));
    settingsBaseline = JSON.stringify(siteFields());
  }

  async function checkDeployment() {
    const current = deployment;
    if (!current || !client) return;
    clearTimeout(polling);
    polls++;
    try {
      const result = await client.deployment(current.commitSha);
      if (deployment !== current || !client) return;
      if (result) element<HTMLAnchorElement>('workflow-link').href = result.url;
      const complete = result?.status === 'completed';
      const message = !result ? '已保存到 GitHub，等待部署任务启动。'
        : !complete ? '已保存到 GitHub，正在构建和部署；公开页面暂未更新。'
        : result.conclusion === 'success' ? '部署成功。公开页面已更新，可打开网站查看。'
        : result.conclusion === 'cancelled' ? '此次部署已取消，可能被较新的保存取代。请查看部署记录确认最新版本。'
        : '内容已保存，但部署未成功。请查看部署日志；公开页面仍是上次成功的版本。';
      element('deployment-message').textContent = message;
      if (!complete && polls < 20) polling = setTimeout(() => { void checkDeployment(); }, 10000);
      if (!complete && polls >= 20) element('deployment-message').textContent += ' 自动检查已暂停，可点击刷新部署状态。';
    } catch {
      if (deployment === current && client) element('deployment-message').textContent = '内容已保存到 GitHub；暂时无法读取部署状态，请打开“查看部署”确认上线结果。';
    }
  }

  function saved(result: SavedFile) {
    deployment = result;
    polls = 0;
    element('deployment-panel').hidden = false;
    element('deployment-message').textContent = '已保存到 GitHub，等待部署任务启动。';
    element<HTMLAnchorElement>('commit-link').href = result.commitUrl;
    element<HTMLAnchorElement>('workflow-link').href = 'https://github.com/Fly0307/fly0307.github.io/actions';
    void checkDeployment();
  }

  async function savePost(draft: boolean) {
    if (!postForm.reportValidity()) return;
    if (draft && file && !wasDraft && !window.confirm('这篇文章已发布。保存为草稿会在下次部署后将它从公开网站移除，确定继续吗？')) return;
    await action(async () => {
      const path = file?.path ?? postPath(input('post-slug').value.trim());
      const source = serializePost(fields(), draft, file?.text);
      const result = await connection().save(path, source, draft ? 'docs(blog): 保存文章草稿' : 'docs(blog): 发布文章内容', file?.sha);
      populatePost({ path, sha: result.sha, text: source });
      // A saved file is authoritative even if the subsequent list refresh fails.
      saved(result);
      tell(draft ? '草稿已写回 GitHub。' : '文章已写回 GitHub，正在等待部署。');
      try { populateList(await connection().posts()); }
      catch { tell('内容已保存，但文章列表刷新失败；请稍后刷新列表。'); }
    });
  }

  async function connectWithToken(token: string) {
    const candidate = new GitHubClient(token);
    try {
      const login = await candidate.login();
      const [paths, content] = await Promise.all([candidate.posts(), candidate.read(siteContentPath)]);
      populateSettings(content);
      client = candidate;
      populateList(paths);
      populatePost();
      switchTab('articles');
      element('session-user').textContent = login;
      element('login-panel').hidden = true;
      element('workspace').hidden = false;
      tell('已连接 GitHub，可以开始写作。');
      input('post-title').focus();
    } catch (error) { candidate.disconnect(); throw error; }
  }

  element('github-login').addEventListener('click', () => { void action(startGitHubLogin); });
  element('oauth-setup').hidden = oauthConfigured();
  element<HTMLFormElement>('login-form').addEventListener('submit', event => {
    event.preventDefault();
    const token = input('github-token').value;
    input('github-token').value = '';
    void action(async () => {
      await connectWithToken(token);
    });
  });

  element('logout').addEventListener('click', () => {
    if (!mayLeave(dirtyPost() || dirtySettings())) return;
    clearTimeout(polling);
    clearTimeout(previewTimer);
    client?.disconnect();
    client = null;
    file = null;
    siteFile = null;
    deployment = null;
    postBaseline = '';
    settingsBaseline = '';
    uploads.forEach(url => URL.revokeObjectURL(url));
    uploads.clear();
    postForm.reset();
    settingsForm.reset();
    element('post-preview').replaceChildren();
    element('post-list').replaceChildren();
    element('projects-editor').replaceChildren();
    element('deployment-panel').hidden = true;
    element('workspace').hidden = true;
    element('login-panel').hidden = false;
    tell('已退出，登录令牌已从当前页面清除。');
    input('github-token').focus();
  });

  element('articles-tab').addEventListener('click', () => { switchTab('articles'); });
  element('settings-tab').addEventListener('click', () => { switchTab('settings'); });
  element('new-post').addEventListener('click', () => {
    if (!mayLeave(dirtyPost())) return;
    populatePost(); switchTab('articles'); input('post-title').focus();
  });
  element('refresh-posts').addEventListener('click', () => { void action(async () => { populateList(await connection().posts()); tell('文章列表已刷新。'); }); });
  element('reload-post').addEventListener('click', () => {
    if (!file || !mayLeave(dirtyPost())) return;
    const path = file.path;
    void action(async () => { populatePost(await connection().read(path)); tell('已重新加载 GitHub 最新版本。'); });
  });
  postForm.addEventListener('input', () => {
    markPost();
    clearTimeout(previewTimer);
    previewTimer = setTimeout(preview, 160);
  });
  postForm.addEventListener('submit', event => { event.preventDefault(); void savePost(false); });
  element('save-draft').addEventListener('click', () => { void savePost(true); });
  element('download-post').addEventListener('click', () => {
    try {
      const source = serializePost(fields(), wasDraft, file?.text, false);
      const url = URL.createObjectURL(new Blob([source], { type: 'text/markdown;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${input('post-slug').value.split('/').pop() || 'untitled'}.md`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { tell(error instanceof Error ? error.message : '下载失败。', true); }
  });
  element('upload-image').addEventListener('click', () => { input('image-file').click(); });
  input('image-file').addEventListener('change', () => {
    const image = input('image-file').files?.[0];
    input('image-file').value = '';
    if (!image) return;
    void action(async () => {
      if (image.size > 5 * 1024 * 1024) throw new Error('图片不能超过 5 MiB，请压缩后上传。');
      const bytes = new Uint8Array(await image.arrayBuffer());
      const extension = imageExtension(image.type, bytes);
      const path = `public/uploads/${today().slice(0, 7).replace('-', '/')}/${crypto.randomUUID()}.${extension}`;
      const result = await connection().save(path, bytes, 'docs(media): 上传文章图片');
      const publicPath = path.slice('public'.length);
      uploads.set(publicPath, URL.createObjectURL(image));
      const body = element<HTMLTextAreaElement>('post-body');
      const alt = image.name.replace(/\.[^.]+$/, '').replace(/[\[\]<>\r\n]/g, ' ').trim() || '图片';
      body.setRangeText(`\n![${alt}](${publicPath})\n`, body.selectionStart, body.selectionEnd, 'end');
      markPost(); preview(); saved(result);
      tell('图片已上传并插入正文，请保存文章以保留引用。');
    });
  });
  element('add-project').addEventListener('click', () => {
    if (element('projects-editor').children.length >= 30) { tell('最多支持 30 个项目。', true); return; }
    const card = projectCard({ name: '', url: '', zh: '', en: '' });
    element('projects-editor').append(card);
    card.querySelector<HTMLInputElement>('input')?.focus();
  });
  settingsForm.addEventListener('submit', event => {
    event.preventDefault();
    if (!settingsForm.reportValidity()) return;
    void action(async () => {
      if (!siteFile) throw new Error('请先重新加载资料。');
      const validated = siteContentSchema.safeParse(siteFields());
      if (!validated.success) throw new Error('请检查所有中英文内容、邮箱和链接；链接仅支持 http 或 https。');
      const source = `${JSON.stringify(validated.data, null, 2)}\n`;
      const result = await connection().save(siteContentPath, source, 'docs(profile): 更新个人介绍与项目', siteFile.sha);
      populateSettings({ path: siteContentPath, text: source, sha: result.sha });
      saved(result);
      tell('个人介绍与项目已写回 GitHub，等待部署后更新。');
    });
  });
  element('reload-settings').addEventListener('click', () => {
    if (!mayLeave(dirtySettings())) return;
    void action(async () => { populateSettings(await connection().read(siteContentPath)); tell('已重新加载最新资料。'); });
  });
  element('check-deployment').addEventListener('click', () => { polls = 0; void checkDeployment(); });
  window.addEventListener('beforeunload', event => {
    if (client && (busy || dirtyPost() || dirtySettings())) event.preventDefault();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clearTimeout(polling); }
    else if (deployment && client && polls < 20) void checkDeployment();
  });
  // Keep controls inactive until the initial connection has loaded repository data.
  switchTab(activeTab);
  const callbackParameters = new URLSearchParams(window.location.search);
  if (['oauth_state', 'oauth_code', 'oauth_ticket', 'oauth_error'].some(key => callbackParameters.has(key))) {
    void action(async () => {
      const token = await finishGitHubLogin();
      if (token) await connectWithToken(token);
    });
  }
}
