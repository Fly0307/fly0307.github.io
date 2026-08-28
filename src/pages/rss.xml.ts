import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import { getPublishedPosts } from '../lib/posts';

export const GET: APIRoute = async (context) => {
  const posts = getPublishedPosts(await getCollection('blog'));

  return rss({
    title: 'UnlearnedMan · Transmissions',
    description: 'Research notes and technical transmissions from UnlearnedMan.',
    site: context.site!,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.publishedAt,
      link: `/blog/${post.id}/`,
      categories: post.data.tags,
      customData: `<language>${post.data.language}</language>`,
    })),
  });
};
