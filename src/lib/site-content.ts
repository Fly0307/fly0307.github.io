import { z } from 'astro/zod';

const text = z.string().trim().min(1).max(5000);
const webUrl = z.url().refine(value => /^https?:\/\//i.test(value), '请填写 http 或 https 链接');
const bilingual = z.object({ zh: text, en: text });

export const siteContentSchema = z.object({
  name: text.max(100),
  email: z.email(),
  github: webUrl,
  hero: bilingual,
  about: bilingual,
  projects: z.array(z.object({ name: text.max(100), url: webUrl, zh: text, en: text })).max(30),
});

export type SiteContent = z.infer<typeof siteContentSchema>;
