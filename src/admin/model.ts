import { parseDocument } from 'yaml';
import { postSchema } from '../lib/post-schema';

export const postDirectory = 'src/content/blog/';
export const siteContentPath = 'src/data/site-content.json';

export interface PostFields {
  title: string;
  description: string;
  publishedAt: string;
  updatedAt: string;
  language: 'zh' | 'en';
  tags: string;
  featured: boolean;
  body: string;
}

export interface ParsedPost {
  fields: PostFields;
  draft: boolean;
  source: string;
}

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('数据格式不正确。');
  return value as Record<string, unknown>;
}

function frontmatter(source: string) {
  const match = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
  if (!match) throw new Error('文章缺少有效的 YAML 元数据（---）。');
  const doc = parseDocument(match[1], { uniqueKeys: true });
  if (doc.errors.length) throw new Error(`文章元数据无效：${doc.errors[0].message}`);
  const data = record(doc.toJS({ maxAliasCount: 0 }));
  return { doc, data, body: source.slice(match[0].length) };
}

function dateInput(value: unknown): string {
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return '';
}

export function parsePost(source: string): ParsedPost {
  const { data, body } = frontmatter(source);
  const validated = postSchema.safeParse(data);
  if (!validated.success) throw new Error('文章元数据未通过校验，请在 GitHub 中修正后重试。');
  const post = validated.data;
  return {
    source,
    draft: post.draft,
    fields: {
      title: post.title,
      description: post.description,
      publishedAt: dateInput(data.publishedAt),
      updatedAt: dateInput(data.updatedAt),
      language: post.language,
      tags: post.tags.join(', '),
      featured: post.featured,
      body,
    },
  };
}

export function serializePost(fields: PostFields, draft: boolean, original?: string, validate = true): string {
  if (validate && !fields.body.trim()) throw new Error('请先填写文章正文。');
  const parsed = original ? frontmatter(original) : null;
  const doc = parsed?.doc ?? parseDocument('{}');
  const previous = parsed?.data ?? {};
  const unchangedDate = (key: string, value: string) => dateInput(previous[key]) === value ? previous[key] : value;
  const data = {
    title: fields.title.trim(),
    description: fields.description.trim(),
    publishedAt: unchangedDate('publishedAt', fields.publishedAt),
    ...(fields.updatedAt ? { updatedAt: unchangedDate('updatedAt', fields.updatedAt) } : {}),
    language: fields.language,
    tags: [...new Set(fields.tags.split(/[,，]/).map(tag => tag.trim()).filter(Boolean))],
    draft,
    featured: fields.featured,
  };
  const result = postSchema.safeParse(data);
  if (validate && !result.success) throw new Error('请检查标题、摘要、语言和日期；更新日期不能早于发布日期。');
  for (const [key, value] of Object.entries(data)) doc.set(key, value);
  if (!fields.updatedAt) doc.delete('updatedAt');
  const source = `---\n${doc.toString({ lineWidth: 0 })}---\n${fields.body}`;
  if (new TextEncoder().encode(source).length > 900_000) throw new Error('文章过大，请将图片通过上传按钮插入，勿嵌入 Base64 图片。');
  return source;
}

export function postPath(slug: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug === 'blog-template') {
    throw new Error('文章地址请使用小写英文、数字和连字符，不能使用 blog-template。');
  }
  return `${postDirectory}${slug}.md`;
}

export function writablePath(path: string): boolean {
  if (path.includes('..') || path.includes('\\') || path.includes('%') || path.includes('//')) return false;
  if (path === siteContentPath) return true;
  if (path.startsWith(postDirectory)) {
    const relative = path.slice(postDirectory.length);
    return !relative.split('/').includes('blog-template.md') && /^(?:[^/.][^/]*\/)*[^/.][^/]*\.md$/.test(relative);
  }
  return /^public\/uploads\/\d{4}\/\d{2}\/[a-z0-9-]+\.(jpg|png|webp|gif|avif)$/.test(path);
}

export function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 16384) binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return btoa(binary);
}

export function decodeText(encoded: string): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(encoded.replace(/\s/g, '')), c => c.charCodeAt(0)));
}

export function imageExtension(type: string, bytes: Uint8Array): string {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  const matches: Record<string, [string, boolean]> = {
    'image/jpeg': ['jpg', bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255],
    'image/png': ['png', bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10'],
    'image/gif': ['gif', ['GIF87a', 'GIF89a'].includes(ascii(0, 6))],
    'image/webp': ['webp', ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP'],
    'image/avif': ['avif', ascii(4, 8) === 'ftyp' && ['avif', 'avis'].includes(ascii(8, 12))],
  };
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error('图片大小须在 0–5 MiB 之间。');
  const match = matches[type];
  if (!match?.[1]) throw new Error('请选择真实的 JPEG、PNG、WebP、GIF 或 AVIF 图片，不支持 SVG。');
  return match[0];
}
