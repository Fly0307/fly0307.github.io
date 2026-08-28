import type { PostData } from './post-schema';

export interface PostRecord {
  id: string;
  data: PostData;
  body?: string;
}

const newestFirst = (a: PostRecord, b: PostRecord) =>
  b.data.publishedAt.getTime() - a.data.publishedAt.getTime();

export function getPublishedPosts<T extends PostRecord>(posts: T[]): T[] {
  return posts.filter((post) => !post.data.draft).sort(newestFirst);
}

export function selectHomepagePosts<T extends PostRecord>(posts: T[], limit = 3): T[] {
  return getPublishedPosts(posts).sort((a, b) =>
    Number(b.data.featured) - Number(a.data.featured) || newestFirst(a, b),
  ).slice(0, limit);
}

export function normalizeTag(tag: string): string {
  return Array.from(tag
    .trim()
    .normalize('NFKC')
    .toLocaleLowerCase('en-US'), (character) => {
    if (/^[a-z0-9]$/.test(character)) return character;
    return `~${character.codePointAt(0)!.toString(16)}~`;
  }).join('');
}

export function estimateReadingMinutes(body = ''): number {
  const cjk = body.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  const latin = body.replace(/[\u3400-\u9fff]/g, ' ').match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
  return Math.max(1, Math.ceil((cjk + latin) / 300));
}
