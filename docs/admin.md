# 站点内容管理后台

入口为 `/admin/`。保留 Astro 静态站点及 GitHub Pages 部署，使用 GitHub REST API 读写源文件。

## GitHub 一键登录（推荐）

首次需要配置一个 Cloudflare Worker 和 GitHub App，以后点击“使用 GitHub 登录”即可自动跳转授权并返回。无需手动寻找、复制或续填登录令牌。页面刷新或会话过期后再次点击登录，GitHub 会使用已有登录状态；首次授权、撤销授权后或 GitHub 要求验证时仍需确认。

### 1. 创建授权服务

注册并登录 Cloudflare，启用 Workers。进入此仓库目录，使用 Wrangler：

```sh
npx wrangler@4 login
npx wrangler@4 deploy --config auth-worker/wrangler.toml
```

记录返回的服务地址，例如 `https://fly0307-admin-auth.<你的子域>.workers.dev`。在尚未配置应用密钥时服务返回 503，这是预期状态。前端仍由 GitHub Pages 托管，Worker 仅处理登录，不保存文章或长期令牌，不需要数据库。

### 2. 注册并安装 GitHub App

打开 [注册 GitHub App](https://github.com/settings/apps/new)，按以下设置：

- App name：选择一个未被占用的名称，例如 `Fly0307 Archive Editor`。
- Homepage URL：`https://fly0307.github.io/`。
- Callback URL：上一步 Worker 地址加 `/callback`，必须准确匹配。
- Webhook：取消 Active；本应用不需要 Webhook。
- Repository permissions：Contents 为 Read and write；Metadata 保持默认 Read-only；其他权限无需开启。
- 保留用户令牌过期设置。不需要生成 App private key，也无需申请 Workflows 写入权限。
- Who can install this GitHub App：Only on this account。

创建后在 Install App 中安装到 Fly0307，选择 **Only select repositories → fly0307.github.io**。取得页面上的 **Client ID**（不是 App ID），生成一个 Client secret。

### 3. 填写服务端配置

将 Client ID 填入 `auth-worker/wrangler.toml` 的 `GITHUB_CLIENT_ID`。`REPOSITORY_ID` 已固定为已核对的 `479644999`，`SITE_ORIGIN` 是 `https://fly0307.github.io`。

```sh
npx wrangler@4 secret put GITHUB_CLIENT_SECRET --config auth-worker/wrangler.toml
openssl rand -hex 32 | npx wrangler@4 secret put STATE_SECRET --config auth-worker/wrangler.toml
npx wrangler@4 deploy --config auth-worker/wrangler.toml
```

第一条命令会提示输入 Client secret。密钥只填写到 Cloudflare，**不要发送到聊天、写入源码或提交 GitHub**。第二条命令自动生成用于校验临时登录状态的随机密钥。

访问服务地址的 `/health`，应得到 `{"configured":true}`。

### 4. 连接后台

将 `src/data/admin-config.json` 的 `authServiceUrl` 改为 Worker HTTPS 地址（不加路径），提交并推送。例如：

```json
{ "authServiceUrl": "https://fly0307-admin-auth.example.workers.dev" }
```

公开的 Worker 地址和 Client ID 可以提交；Client secret 和 STATE_SECRET 绝不能提交。也可以只把 Worker 地址告诉 Codex，由 Codex 更新站点配置。

GitHub Pages 部署成功后，在 `/admin/` 点击“使用 GitHub 登录”，应自动完成跳转和返回。测试新建一篇草稿并确认提交和部署状态，然后再正式发布。若出现权限提示，先确认 App 已安装到此仓库且有 Contents 写入权限。

### 授权流程

后台生成短期 state 与 PKCE 验证值 → Worker 设置带签名、HttpOnly 的临时 cookie 并跳转 GitHub → 回调校验 cookie/state 后返回短期授权码和签名票据 → 后台用 PKCE 验证值向 Worker 换取用户访问令牌 → Worker 校验 Fly0307 身份及仓库 ID → 后台在内存中使用令牌调用 GitHub。

访问令牌和应用密钥不会出现在 URL 中。state 与 PKCE 临时验证值暂存 sessionStorage，完成或取消登录即删除；访问令牌不持久化。Worker 不记录密钥，不保存访问令牌或刷新令牌。CORS 仅允许精确匹配的网站来源，授权票据有效期 5 分钟。用户令牌只具有该 App 已安装仓库的权限；只安装到此站点仓库。

## 备用登录：仓库专用令牌

1. 在 GitHub 创建 Fine-grained personal access token，设置合适的名称和有效期。
2. Resource owner 选择 Fly0307；Repository access 选择 Only select repositories，仅选择 fly0307.github.io。
3. Repository permissions 中 Contents 选 Read and write；Metadata 保持默认。不需要 Workflows 写入权限。
4. 生成后在 `/admin/` 输入令牌登录，不要把令牌发给其他人。

令牌只存于当前页面内存，不写入文件、URL、localStorage 或 cookie。刷新页面或退出后需要重新登录。页面仅允许 Fly0307 操作本仓库，写入范围限文章、上传目录及站点数据。GitHub 的仓库权限是最终权限边界；前端账号检查不是服务端鉴权。

此方式保留在折叠面板中，用于授权服务维护时备用。正常使用 GitHub 一键登录即可。

## 文章

- 支持新建、读取、编辑 Markdown，含中文或英文单一语言、摘要、日期、标签、首页推荐。
- “保存草稿”写入 `draft: true`；“发布文章”写入 `draft: false`。将已发布文章转成草稿前会确认。
- 草稿只是不生成公开文章，源文件仍在公开 GitHub 仓库，不能用于存放私密内容。
- 文章路径新建后固定；保存时使用读取版本的 SHA，遇到并发修改拒绝覆盖，可先下载备份再重新加载。
- 编辑缓冲留在当前页面；切换文章或刷新离开前提示未保存变更，可随时下载 Markdown 备份。不会把未保存正文写入浏览器持久存储。
- Markdown 预览使用 marked + DOMPurify，去除脚本和交互元素。预览不是 Astro 的完全复制，最终排版以构建后文章为准。
- 编辑现有文章保留未识别的 frontmatter 字段及原文 HTML。现有山山文章与相册继续保留。
- 新文章 slug 使用小写英文、数字与连字符；不得覆盖模板。

## 图片

支持 JPEG / PNG / WebP / GIF / AVIF，校验 MIME、文件头与 5 MiB 上限。上传写入 `public/uploads/YYYY/MM/<uuid>.<ext>`，插入 `/uploads/...` Markdown 引用并提供当前页面本地预览。上传后需保存文章才保留正文引用。SVG、HTML 不允许上传。图片本身和文章都会公开保存在仓库中。

## 个人介绍与项目

表单修改 `src/data/site-content.json`。站点在构建时验证该数据并用于首页、关于、页眉页脚及项目卡片。可添加、移除和上下移动项目；点击保存后形成一个 GitHub 提交。

## 保存与上线

保存到 `main` 会触发现有部署工作流。后台区分“已写回 GitHub”与“部署成功”，并链接到该提交、该次部署及公开页面。部署状态通过公开 Actions API 读取，不额外申请 Actions 权限；无法读取时手动到 GitHub 查看。不会把保存成功当成部署成功。

网络超时可能发生在 GitHub 已接受写入之后；此时先查看 GitHub 保存记录，再重新加载后继续操作，避免重复写入。不自动重试冲突或覆盖远端改动。

## 验证

运行 `npm test`。后台接口和 Worker 授权测试使用模拟 GitHub 响应，浏览器验证也不创建真实文章或上传测试图片。真实 GitHub App 授权和写回需要完成上述账号、应用与 Worker 配置，在启用后首次登录时验证。
